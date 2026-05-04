import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Asset } from '../../db/database';
import type { Language } from '../../translations';
import { translations } from '../../translations';
import { fetchNewsBatch, invalidateNewsCache, timeAgo, type NewsItem } from '../../services/news';

interface NewsTabProps {
    assets: Asset[];
    exchangeRate: number;
    language: Language;
}

type SymbolState =
    | { status: 'loading' }
    | { status: 'success'; items: NewsItem[] };

const MAX_SYMBOLS = 10;

function getTopSymbols(assets: Asset[], exchangeRate: number): string[] {
    const valueBySymbol = new Map<string, number>();
    for (const asset of assets) {
        const price = asset.currentPrice ?? 0;
        const value = price * asset.quantity * (asset.market === 'TW' ? 1 : exchangeRate);
        valueBySymbol.set(asset.symbol, (valueBySymbol.get(asset.symbol) ?? 0) + value);
    }
    return [...valueBySymbol.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, MAX_SYMBOLS)
        .map(([symbol]) => symbol);
}

function SkeletonCard() {
    return (
        <div className="news-card news-card--skeleton">
            <div className="news-symbol-header skeleton-bar" style={{ width: '80px', height: '18px' }} />
            <div className="news-items">
                {[0, 1, 2].map((i) => (
                    <div key={i} className="news-item skeleton-item">
                        <div className="skeleton-bar" style={{ width: '100%', height: '14px', marginBottom: '4px' }} />
                        <div className="skeleton-bar" style={{ width: '60%', height: '12px' }} />
                    </div>
                ))}
            </div>
        </div>
    );
}

export function NewsTab({ assets, exchangeRate, language }: NewsTabProps) {
    const t = translations[language];
    const proxyConfigured = Boolean(import.meta.env.VITE_CORS_PROXY_URL);

    const symbols = useMemo(
        () => getTopSymbols(assets, exchangeRate),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [assets.length, exchangeRate]
    );

    const [newsState, setNewsState] = useState<Map<string, SymbolState>>(new Map());

    const loadNews = useCallback(async (syms: string[]) => {
        if (syms.length === 0) return;

        setNewsState((prev) => {
            const next = new Map(prev);
            for (const s of syms) {
                if (!next.has(s)) next.set(s, { status: 'loading' });
            }
            return next;
        });

        const results = await fetchNewsBatch(syms);
        setNewsState((prev) => {
            const next = new Map(prev);
            for (const [sym, items] of results) {
                next.set(sym, { status: 'success', items });
            }
            return next;
        });
    }, []);

    // Invalidate cache and reload when assets change
    useEffect(() => {
        if (assets.length === 0) return;
        invalidateNewsCache();
        setNewsState(new Map());
    }, [assets.length]);

    // Load news when symbols list is resolved
    useEffect(() => {
        if (!proxyConfigured || symbols.length === 0) return;
        loadNews(symbols);
    }, [symbols, proxyConfigured, loadNews]);

    // Refresh on tab visibility
    useEffect(() => {
        if (!proxyConfigured) return;
        const onVisible = () => {
            if (document.visibilityState === 'visible') {
                loadNews(symbols);
            }
        };
        document.addEventListener('visibilitychange', onVisible);
        return () => document.removeEventListener('visibilitychange', onVisible);
    }, [symbols, proxyConfigured, loadNews]);

    if (!proxyConfigured) {
        return (
            <div className="news-tab">
                <div className="news-proxy-notice">
                    <span className="news-proxy-icon">⚠️</span>
                    <p>{t.newsProxyRequired}</p>
                </div>
            </div>
        );
    }

    if (assets.length === 0) {
        return (
            <div className="news-tab">
                <div className="news-empty-state">
                    <p>{t.newsAddAssets}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="news-tab">
            <div className="news-header">
                <h2>{t.news}</h2>
                <span className="news-subtitle">{t.newsTopByValue}</span>
            </div>
            <div className="news-list">
                {symbols.map((symbol) => {
                    const state = newsState.get(symbol);
                    if (!state || state.status === 'loading') {
                        return <SkeletonCard key={symbol} />;
                    }
                    return (
                        <div key={symbol} className="news-card">
                            <div className="news-symbol-header">{symbol}</div>
                            {state.items.length === 0 ? (
                                <p className="news-empty-card">{t.noRecentNews}</p>
                            ) : (
                                <ul className="news-items">
                                    {state.items.map((item) => (
                                        <li key={item.link} className="news-item">
                                            <a
                                                href={item.link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="news-title"
                                            >
                                                {item.title}
                                            </a>
                                            <div className="news-meta">
                                                <span className="news-publisher">{item.publisher}</span>
                                                <span className="news-time">{timeAgo(item.providerPublishTime)}</span>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
