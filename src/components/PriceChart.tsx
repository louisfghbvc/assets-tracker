import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, CrosshairMode } from 'lightweight-charts';
import { priceService } from '../services/price';

interface PriceChartProps {
    symbol: string;
    darkMode?: boolean;
    language: 'en' | 'zh';
}

import { translations } from '../translations';

export const PriceChart: React.FC<PriceChartProps> = ({ symbol, darkMode = true, language }) => {
    const t = translations[language];
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const [loading, setLoading] = useState(true);
    const [range, setRange] = useState('1y');
    const [interval, setInterval] = useState('1d');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!chartContainerRef.current) return;

        let mounted = true;
        let chart: any = null;
        let series: any = null;

        const initAndFetch = async () => {
            setLoading(true);
            setError(null);

            try {
                const data = await priceService.fetchHistory(symbol, range, interval);
                if (!mounted || !chartContainerRef.current) return;

                if (data.length === 0) {
                    setError("No data found for this range.");
                    setLoading(false);
                    return;
                }

                // Create chart only after data is fetched and we are still mounted
                chart = createChart(chartContainerRef.current, {
                    layout: {
                        background: { type: ColorType.Solid, color: 'transparent' },
                        textColor: darkMode ? 'rgba(255, 255, 255, 0.7)' : '#333',
                        fontSize: 10,
                    },
                    grid: {
                        vertLines: { color: darkMode ? 'rgba(255, 255, 255, 0.05)' : '#eee' },
                        horzLines: { color: darkMode ? 'rgba(255, 255, 255, 0.05)' : '#eee' },
                    },
                    width: chartContainerRef.current.clientWidth,
                    height: 240,
                    timeScale: {
                        borderVisible: false,
                        timeVisible: true,
                    },
                    rightPriceScale: {
                        borderVisible: false,
                    },
                    handleScroll: true,
                    handleScale: true,
                    crosshair: {
                        mode: CrosshairMode.Normal,
                    },
                });

                // In lightweight-charts v5, use addCandlestickSeries or check if it exists
                // The library might have changed how methods are called or exported.
                // Let's use a more defensive approach or verify the method exists.
                if (typeof chart.addCandlestickSeries === 'function') {
                    series = chart.addCandlestickSeries({
                        upColor: '#26a69a',
                        downColor: '#ef5350',
                        borderVisible: false,
                        wickUpColor: '#26a69a',
                        wickDownColor: '#ef5350',
                    });
                } else if (typeof chart.addSeries === 'function') {
                    // Try the new v5 generic way if specific one fails
                    // This is a common pattern for v5
                    const { CandlestickSeries } = await import('lightweight-charts');
                    series = chart.addSeries(CandlestickSeries, {
                        upColor: '#26a69a',
                        downColor: '#ef5350',
                        borderVisible: false,
                        wickUpColor: '#26a69a',
                        wickDownColor: '#ef5350',
                    });
                } else {
                    throw new Error("Could not find addSeries or addCandlestickSeries on chart object.");
                }

                const formattedData = data.map(d => ({
                    time: d.time as any,
                    open: d.open,
                    high: d.high,
                    low: d.low,
                    close: d.close,
                })).sort((a, b) => a.time - b.time);

                series.setData(formattedData);

                // Allow a bit of time for layout
                setTimeout(() => {
                    if (mounted && chart) chart.timeScale().fitContent();
                }, 50);

            } catch (err: any) {
                if (mounted) {
                    const msg = typeof err === 'string' ? err : err.message || "Unknown error";
                    setError(`Error: ${msg}`);
                }
            } finally {
                if (mounted) setLoading(false);
            }
        };

        initAndFetch();

        const handleResize = () => {
            if (chart && chartContainerRef.current) {
                chart.applyOptions({ width: chartContainerRef.current.clientWidth });
            }
        };

        window.addEventListener('resize', handleResize);

        return () => {
            mounted = false;
            window.removeEventListener('resize', handleResize);
            if (chart) {
                chart.remove();
                chart = null;
            }
        };
    }, [symbol, range, interval, darkMode]);

    return (
        <div className="price-chart-wrapper" onClick={(e) => e.stopPropagation()}>
            <div className="chart-header">
                <div className="chart-range-selector">
                    {[
                        { label: t.dailyChart, interval: '1d', range: '1y' },
                        { label: t.weeklyChart, interval: '1wk', range: '5y' },
                        { label: t.monthlyChart, interval: '1mo', range: 'max' }
                    ].map((opt) => (
                        <button
                            key={opt.interval}
                            className={`range-btn ${interval === opt.interval ? 'active' : ''}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                setInterval(opt.interval);
                                setRange(opt.range);
                            }}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="chart-main-area">
                {loading && (
                    <div className="chart-overlay">
                        <div className="spinner"></div>
                        <span>Loading Chart...</span>
                    </div>
                )}
                {error && (
                    <div className="chart-overlay error">
                        <span>{error}</span>
                    </div>
                )}
                <div ref={chartContainerRef} className="chart-canvas-container" />
            </div>
        </div>
    );
};
