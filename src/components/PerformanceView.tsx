import { useState, useMemo, useEffect } from 'react';
import { db, type Asset } from '../db/database';
import {
    groupedAssetReturns,
    portfolioAnnualizedReturn,
    benchmarkAnnualizedReturn,
    portfolioHoldingDays,
    portfolioStartDate,
} from '../utils/performance';
import { priceService } from '../services/price';
import type { Language } from '../translations';
import { translations } from '../translations';

interface PerformanceViewProps {
    assets: Asset[];
    exchangeRate: number;
    language: Language;
    hideValues: boolean;
}

interface BenchmarkData {
    symbol: string;
    label: string;
    annReturn: number | null;
    loading: boolean;
    error: boolean;
}

interface SetupSectionProps {
    undatedAssets: Asset[];
    t: (key: keyof typeof translations.en) => string;
    pendingDates: Record<number, string>;
    setPendingDates: React.Dispatch<React.SetStateAction<Record<number, string>>>;
    saving: boolean;
    handleSaveDates: () => Promise<void>;
}

function SetupSection({ undatedAssets, t, pendingDates, setPendingDates, saving, handleSaveDates }: SetupSectionProps) {
    return (
        <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ marginBottom: 12, color: 'var(--text-secondary)' }}>
                📅 {t('setupPurchaseDates')} ({undatedAssets.length} {t('assetsMissingPurchaseDate')})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {undatedAssets.map(a => (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ minWidth: 80, fontWeight: 600 }}>{a.symbol}</span>
                        <input
                            type="date"
                            style={{
                                flex: 1,
                                background: 'var(--card-bg)',
                                border: '1px solid var(--border)',
                                borderRadius: 8,
                                padding: '6px 10px',
                                color: 'var(--text-primary)',
                                fontSize: '0.9rem',
                            }}
                            value={pendingDates[a.id!] || ''}
                            onChange={e =>
                                setPendingDates(prev => ({ ...prev, [a.id!]: e.target.value }))
                            }
                        />
                    </div>
                ))}
            </div>
            <button
                onClick={handleSaveDates}
                disabled={saving || Object.keys(pendingDates).length === 0}
                style={{
                    marginTop: 16,
                    padding: '8px 20px',
                    background: 'var(--accent)',
                    border: 'none',
                    borderRadius: 8,
                    color: '#fff',
                    fontWeight: 600,
                    cursor: 'pointer',
                    opacity: saving || Object.keys(pendingDates).length === 0 ? 0.5 : 1,
                }}
            >
                {saving ? '...' : t('saveAll')}
            </button>
        </div>
    );
}

export function PerformanceView({ assets, exchangeRate, language, hideValues }: PerformanceViewProps) {
    const t = (key: keyof typeof translations.en) =>
        (translations[language] as Record<string, string>)[key] || translations.en[key];

    const undatedAssets = useMemo(() => assets.filter(a => !a.purchaseDate || a.purchaseDate <= 0), [assets]);
    const allUndated = undatedAssets.length === assets.length && assets.length > 0;
    const hasUndated = undatedAssets.length > 0;

    const [pendingDates, setPendingDates] = useState<Record<number, string>>({});
    const [saving, setSaving] = useState(false);
    const benchmarkLabels: Record<string, { en: string; zh: string }> = {
        '^TWII': { en: 'Taiwan Weighted Index (TAIEX)', zh: '台灣加權指數 (TAIEX)' },
        'SPY': { en: 'S&P 500 (SPY)', zh: '標普500 (SPY)' },
    };
    const [benchmarks, setBenchmarks] = useState<BenchmarkData[]>([
        { symbol: '^TWII', label: '', annReturn: null, loading: false, error: false },
        { symbol: 'SPY', label: '', annReturn: null, loading: false, error: false },
    ]);
    const [benchmarkKey, setBenchmarkKey] = useState(0); // trigger re-fetch on retry

    const { assetReturns, portfolioResult, holdingDays, startDate } = useMemo(() => {
        const holdingDays = portfolioHoldingDays(assets);
        const startDate = portfolioStartDate(assets);
        const portfolioResult = portfolioAnnualizedReturn(assets, exchangeRate);

        const assetReturns = groupedAssetReturns(assets, exchangeRate);

        return { assetReturns, portfolioResult, holdingDays, startDate };
    }, [assets, exchangeRate]);

    useEffect(() => {
        if (!startDate || holdingDays < 1) return;

        let cancelled = false;
        const benchmarkSymbols = ['^TWII', 'SPY'];

        setBenchmarks(prev => prev.map(b => ({ ...b, loading: true, error: false, annReturn: null })));

        Promise.all(
            benchmarkSymbols.map(async (sym) => {
                try {
                    const result = await priceService.fetchBenchmarkPrice(sym, startDate);
                    if (!result) return { sym, annReturn: null, error: true };
                    const ret = benchmarkAnnualizedReturn(result.startPrice, result.currentPrice, holdingDays);
                    return { sym, annReturn: ret, error: false };
                } catch {
                    return { sym, annReturn: null, error: true };
                }
            })
        ).then(results => {
            if (cancelled) return;
            setBenchmarks(prev =>
                prev.map(b => {
                    const found = results.find(r => r.sym === b.symbol);
                    if (!found) return b;
                    return {
                        ...b,
                        loading: false,
                        error: found.error,
                        annReturn: found.annReturn,
                    };
                })
            );
        }).catch(err => console.error('Benchmark state update failed:', err));

        return () => { cancelled = true; };
    }, [startDate, holdingDays, benchmarkKey]);

    const handleSaveDates = async () => {
        setSaving(true);
        try {
            await Promise.all(
                Object.entries(pendingDates).map(([idStr, dateStr]) => {
                    if (!dateStr) return Promise.resolve();
                    const ms = new Date(dateStr + 'T00:00:00').getTime();
                    if (!ms || Number.isNaN(ms)) return Promise.resolve();
                    const id = parseInt(idStr);
                    if (isNaN(id)) return Promise.resolve();
                    return db.assets.update(id, { purchaseDate: ms });
                })
            );
            setPendingDates({});
        } finally {
            setSaving(false);
        }
    };

    const fmt = (v: number, digits = 1) =>
        (v >= 0 ? '+' : '') + (v * 100).toFixed(digits) + '%';

    const fmtTWD = (v: number) =>
        (v >= 0 ? '+' : '') + Math.round(v).toLocaleString() + ' TWD';

    if (allUndated) {
        return (
            <section className="performance-view animate-fade-in" style={{ padding: '20px 16px' }}>
                <h2 className="view-title" style={{ marginBottom: 16 }}>📊 {t('performance')}</h2>
                <SetupSection
                    undatedAssets={undatedAssets}
                    t={t}
                    pendingDates={pendingDates}
                    setPendingDates={setPendingDates}
                    saving={saving}
                    handleSaveDates={handleSaveDates}
                />
                <div style={{ textAlign: 'center', padding: '40px 20px', opacity: 0.5 }}>
                    <p>{t('noDateForPerformance')}</p>
                </div>
            </section>
        );
    }

    return (
        <section className="performance-view animate-fade-in" style={{ padding: '20px 16px' }}>
            <h2 className="view-title" style={{ marginBottom: 16 }}>📊 {t('performance')}</h2>

            {hasUndated && (
                <SetupSection
                    undatedAssets={undatedAssets}
                    t={t}
                    pendingDates={pendingDates}
                    setPendingDates={setPendingDates}
                    saving={saving}
                    handleSaveDates={handleSaveDates}
                />
            )}

            {/* Portfolio Summary Card */}
            {portfolioResult.value !== null && (
                <div className="card" style={{ marginBottom: 16 }}>
                    <h3 style={{ marginBottom: 12 }}>{t('performanceSummary')}</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 4 }}
                                title={t('cagrMethodologyNote')}>
                                {t('annualizedReturn')} ⓘ
                            </div>
                            <div style={{
                                fontSize: '1.6rem',
                                fontWeight: 700,
                                color: portfolioResult.value >= 0 ? 'var(--positive)' : 'var(--negative)',
                            }}>
                                {hideValues ? '****' : fmt(portfolioResult.value)}
                            </div>
                        </div>
                        <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
                                {t('holdingPeriod')}
                            </div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>
                                {holdingDays} {t('days')}
                            </div>
                        </div>
                    </div>
                    {portfolioResult.excludedCount > 0 && (
                        <div style={{
                            marginTop: 8,
                            fontSize: '0.75rem',
                            color: 'var(--text-secondary)',
                            padding: '4px 8px',
                            background: 'rgba(255,200,0,0.1)',
                            borderRadius: 6,
                        }}>
                            ⚠️ {t('partialDataWarning')} ({portfolioResult.excludedCount})
                        </div>
                    )}
                </div>
            )}

            {/* Asset Performance Table */}
            <div className="card" style={{ marginBottom: 16 }}>
                <h3 style={{ marginBottom: 12 }}>📈 {t('performanceRanking')}</h3>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                                    {t('assetColumn')}
                                </th>
                                <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                                    {t('holdingDays')}
                                </th>
                                <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                                    {t('annualizedReturn')}
                                </th>
                                <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                                    {t('unrealizedPnl')}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {assetReturns.map(({ symbol, market, name, annReturn, holdingDays: days, pnlTWD, shortHolding, hasCostData }) => (
                                <tr key={`${symbol}::${market}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                    <td style={{ padding: '8px 8px', fontWeight: 600 }}>
                                        {symbol}
                                        {name && name !== symbol && (
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 400 }}>
                                                {name}
                                            </div>
                                        )}
                                    </td>
                                    <td style={{ textAlign: 'right', padding: '8px 8px', color: 'var(--text-secondary)' }}>
                                        {days > 0 ? days : '—'}
                                    </td>
                                    <td style={{ textAlign: 'right', padding: '8px 8px' }}>
                                        {annReturn !== null ? (
                                            <span style={{ color: annReturn >= 0 ? 'var(--positive)' : 'var(--negative)' }}>
                                                {hideValues ? '****' : fmt(annReturn)}
                                                {shortHolding && (
                                                    <span title={t('shortHoldingWarning')} style={{ marginLeft: 4, fontSize: '0.7rem' }}>⚠️</span>
                                                )}
                                            </span>
                                        ) : (
                                            <span style={{ color: 'var(--text-secondary)' }}>—</span>
                                        )}
                                    </td>
                                    <td style={{ textAlign: 'right', padding: '8px 8px' }}>
                                        {hasCostData ? (
                                            <span style={{
                                                color: pnlTWD >= 0 ? 'var(--positive)' : 'var(--negative)',
                                                fontSize: '0.8rem',
                                            }}>
                                                {hideValues ? '****' : fmtTWD(pnlTWD)}
                                            </span>
                                        ) : (
                                            <span style={{ color: 'var(--text-secondary)' }}>—</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Benchmark Comparison Card */}
            {portfolioResult.value !== null && holdingDays > 0 && (
                <div className="card">
                    <h3 style={{ marginBottom: 12 }}>🏆 {t('benchmarkComparison')}</h3>
                    <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
                            {t('myPortfolio')}
                        </div>
                        <div style={{
                            fontSize: '1.3rem', fontWeight: 700,
                            color: portfolioResult.value >= 0 ? 'var(--positive)' : 'var(--negative)',
                        }}>
                            {hideValues ? '****' : fmt(portfolioResult.value)}
                        </div>
                    </div>
                    {benchmarks.map(b => (
                        <div key={b.symbol} style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '10px 0', borderTop: '1px solid rgba(255,255,255,0.06)',
                        }}>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{benchmarkLabels[b.symbol]?.[language] ?? b.symbol}</span>
                            {b.loading ? (
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>...</span>
                            ) : b.error ? (
                                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{t('benchmarkUnavailable')}</span>
                                    <button
                                        onClick={() => setBenchmarkKey(k => k + 1)}
                                        style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer' }}
                                    >
                                        {t('retry')}
                                    </button>
                                </span>
                            ) : b.annReturn !== null ? (
                                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ fontWeight: 600, color: b.annReturn >= 0 ? 'var(--positive)' : 'var(--negative)' }}>
                                        {hideValues ? '****' : fmt(b.annReturn)}
                                    </span>
                                    {portfolioResult.value !== null && (
                                        <span style={{
                                            fontSize: '0.7rem', fontWeight: 700,
                                            padding: '2px 6px',
                                            borderRadius: 4,
                                            background: portfolioResult.value >= b.annReturn
                                                ? 'rgba(34,197,94,0.15)'
                                                : 'rgba(239,68,68,0.15)',
                                            color: portfolioResult.value >= b.annReturn ? 'var(--positive)' : 'var(--negative)',
                                        }}>
                                            {portfolioResult.value >= b.annReturn ? `✅ ${t('beatingIndex')}` : `❌ ${t('laggingIndex')}`}
                                        </span>
                                    )}
                                </span>
                            ) : null}
                        </div>
                    ))}
                    <div style={{ marginTop: 8, fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                        {t('benchmarkPeriod').replace('{days}', String(holdingDays))}
                    </div>
                </div>
            )}
        </section>
    );
}
