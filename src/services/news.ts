import { fetchViaProxy } from './proxy';

export interface NewsItem {
    title: string;
    publisher: string;
    link: string;
    providerPublishTime: number;
}

interface CacheEntry {
    items: NewsItem[];
    expiry: number;
    fetchedAt: number;
}

const NEWS_TTL_MS = 15 * 60 * 1000;
const YAHOO_SEARCH_URL = 'https://query1.finance.yahoo.com/v1/finance/search';
const BATCH_SIZE = 3;

const newsCache = new Map<string, CacheEntry>();

const CRYPTO_FIAT_SUFFIXES = new Set(['USD', 'EUR', 'GBP', 'USDT', 'USDC', 'BTC', 'ETH']);

function normalizeSymbol(symbol: string): string {
    const dashIdx = symbol.indexOf('-');
    if (dashIdx === -1) return symbol;
    const suffix = symbol.slice(dashIdx + 1).toUpperCase();
    if (CRYPTO_FIAT_SUFFIXES.has(suffix)) return symbol.slice(0, dashIdx);
    return symbol;
}

export function timeAgo(epochSecs: number): string {
    const diffMs = Date.now() - epochSecs * 1000;
    const diffSecs = Math.floor(diffMs / 1000);
    if (diffSecs < 60) return `${diffSecs}s ago`;
    const diffMins = Math.floor(diffSecs / 60);
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
}

function parseNewsItems(data: any): NewsItem[] {
    if (!Array.isArray(data?.news)) return [];
    return data.news
        .filter((item: any) =>
            typeof item.title === 'string' &&
            typeof item.link === 'string' &&
            item.link.startsWith('https://') &&
            typeof item.providerPublishTime === 'number' &&
            item.providerPublishTime > 0
        )
        .map((item: any): NewsItem => ({
            title: item.title,
            publisher: item.publisher ?? '',
            link: item.link,
            providerPublishTime: item.providerPublishTime,
        }))
        .sort((a: NewsItem, b: NewsItem) => b.providerPublishTime - a.providerPublishTime);
}

export async function fetchNews(symbol: string): Promise<NewsItem[]> {
    const now = Date.now();
    const cached = newsCache.get(symbol);
    if (cached && now < cached.expiry) return cached.items;

    const fetchedAt = now;
    const query = normalizeSymbol(symbol);
    const url = `${YAHOO_SEARCH_URL}?q=${encodeURIComponent(query)}&newsCount=5&quotesCount=0`;

    const response = await fetchViaProxy(url);
    if (!response) return [];

    let data: any;
    try {
        data = await response.json();
    } catch {
        return [];
    }

    // Discard stale response — a concurrent fetch may have already updated the cache
    const currentEntry = newsCache.get(symbol);
    if (currentEntry && fetchedAt < currentEntry.fetchedAt) return currentEntry.items;

    const items = parseNewsItems(data);
    newsCache.set(symbol, { items, expiry: now + NEWS_TTL_MS, fetchedAt });
    return items;
}

export async function fetchNewsBatch(symbols: string[]): Promise<Map<string, NewsItem[]>> {
    const results = new Map<string, NewsItem[]>();

    for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
        const batch = symbols.slice(i, i + BATCH_SIZE);
        const settled = await Promise.allSettled(
            batch.map((s) => fetchNews(s))
        );
        batch.forEach((s, idx) => {
            const r = settled[idx];
            results.set(s, r.status === 'fulfilled' ? r.value : []);
        });
    }

    return results;
}

export function invalidateNewsCache(): void {
    newsCache.clear();
}
