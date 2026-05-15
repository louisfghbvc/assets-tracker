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
const GOOGLE_NEWS_RSS_URL = 'https://news.google.com/rss/search';
const BATCH_SIZE = 3;
const MAX_ITEMS = 5;

const ZH_KEYWORD_TW = '台股';
const ZH_KEYWORD_CRYPTO = '加密貨幣';
const ZH_DEFAULT_PUBLISHER = '財經新聞';

const newsCache = new Map<string, CacheEntry>();

const CRYPTO_FIAT_SUFFIXES = new Set(['USD', 'EUR', 'GBP', 'USDT', 'USDC', 'BTC', 'ETH']);

function isCryptoSymbol(symbol: string): boolean {
    const dashIdx = symbol.indexOf('-');
    if (dashIdx === -1) return false;
    const suffix = symbol.slice(dashIdx + 1).toUpperCase();
    return CRYPTO_FIAT_SUFFIXES.has(suffix);
}

function normalizeSymbol(symbol: string): string {
    if (!isCryptoSymbol(symbol)) return symbol;
    return symbol.slice(0, symbol.indexOf('-'));
}

function shouldUseChineseNews(symbol: string): boolean {
    if (symbol.endsWith('.TW') || symbol.endsWith('.TWO')) return true;
    return isCryptoSymbol(symbol);
}

function getChineseQuery(symbol: string): string {
    if (symbol.endsWith('.TW') || symbol.endsWith('.TWO')) {
        const code = symbol.replace(/\.TWO?$/, '');
        return `${code} ${ZH_KEYWORD_TW}`;
    }
    return `${normalizeSymbol(symbol)} ${ZH_KEYWORD_CRYPTO}`;
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

function parseYahooNews(data: any): NewsItem[] {
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

function parseGoogleNewsRSS(xml: string): NewsItem[] {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    if (doc.querySelector('parsererror')) return [];
    return [...doc.querySelectorAll('item')]
        .map((item): NewsItem | null => {
            const title = item.querySelector('title')?.textContent;
            const link = item.querySelector('link')?.textContent;
            const pubDate = item.querySelector('pubDate')?.textContent;
            const source = item.querySelector('source')?.textContent;
            if (!title || !link || !pubDate) return null;
            if (!link.startsWith('https://')) return null;
            const epoch = Math.floor(Date.parse(pubDate) / 1000);
            if (!Number.isFinite(epoch) || epoch <= 0) return null;
            return {
                title,
                publisher: source || ZH_DEFAULT_PUBLISHER,
                link,
                providerPublishTime: epoch,
            };
        })
        .filter((x): x is NewsItem => x !== null)
        .sort((a, b) => b.providerPublishTime - a.providerPublishTime)
        .slice(0, MAX_ITEMS);
}

async function fetchYahoo(symbol: string): Promise<NewsItem[]> {
    const query = normalizeSymbol(symbol);
    const url = `${YAHOO_SEARCH_URL}?q=${encodeURIComponent(query)}&newsCount=5&quotesCount=0`;
    const response = await fetchViaProxy(url);
    if (!response) return [];
    try {
        const data = await response.json();
        return parseYahooNews(data);
    } catch {
        return [];
    }
}

async function fetchGoogleNewsZH(symbol: string): Promise<NewsItem[]> {
    const query = getChineseQuery(symbol);
    const url = `${GOOGLE_NEWS_RSS_URL}?q=${encodeURIComponent(query)}&hl=zh-TW&gl=TW&ceid=TW%3Azh-Hant`;
    const response = await fetchViaProxy(url);
    if (!response) return [];
    try {
        const xml = await response.text();
        return parseGoogleNewsRSS(xml);
    } catch {
        return [];
    }
}

export async function fetchNews(symbol: string): Promise<NewsItem[]> {
    const now = Date.now();
    const cached = newsCache.get(symbol);
    if (cached && now < cached.expiry) return cached.items;

    const fetchedAt = now;
    const items = shouldUseChineseNews(symbol)
        ? await fetchGoogleNewsZH(symbol)
        : await fetchYahoo(symbol);

    const current = newsCache.get(symbol);
    if (current && fetchedAt < current.fetchedAt) return current.items;

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
