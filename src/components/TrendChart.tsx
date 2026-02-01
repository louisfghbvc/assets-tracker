import React, { useEffect, useRef } from 'react';
import { createChart, ColorType, CrosshairMode } from 'lightweight-charts';
import { HistoryRecord } from '../db/database';

interface TrendChartProps {
    data: HistoryRecord[];
    darkMode?: boolean;
    mode?: 'value' | 'percent';
}

export const TrendChart: React.FC<TrendChartProps> = ({ data, darkMode = true, mode = 'value' }) => {
    const chartContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!chartContainerRef.current || data.length === 0) return;

        let chart: any = null;

        const initChart = async () => {
            if (!chartContainerRef.current) return;

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
                height: 300,
                timeScale: {
                    borderVisible: false,
                    timeVisible: true,
                    fixLeftEdge: true,
                    fixRightEdge: true,
                },
                rightPriceScale: {
                    borderVisible: false,
                    autoScale: true,
                },
                handleScroll: {
                    mouseWheel: false,
                    pressedMouseMove: false,
                    horzTouchDrag: false,
                    vertTouchDrag: false,
                },
                handleScale: {
                    axisPressedMouseMove: false,
                    mouseWheel: false,
                    pinch: false,
                },
                crosshair: {
                    mode: CrosshairMode.Normal,
                    vertLine: {
                        labelBackgroundColor: '#3b82f6',
                    },
                    horzLine: {
                        labelBackgroundColor: '#3b82f6',
                    },
                },
            });

            const sortedData = [...data].sort((a, b) => a.date.localeCompare(b.date));
            const firstValue = sortedData[0].totalValue;
            const lastValue = sortedData[sortedData.length - 1].totalValue;
            const isUp = lastValue >= firstValue;

            // Colors based on trend
            const themeColor = isUp ? '#10b981' : '#ef4444'; // Emerald vs Rose
            const areaTopColor = isUp ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)';

            const { AreaSeries } = await import('lightweight-charts');
            const series = chart.addSeries(AreaSeries, {
                lineColor: themeColor,
                topColor: areaTopColor,
                bottomColor: 'rgba(0, 0, 0, 0)',
                lineWidth: 3,
                priceFormat: mode === 'percent' ? {
                    type: 'custom',
                    formatter: (price: number) => `${price.toFixed(2)}%`,
                } : {
                    type: 'price',
                    precision: 0,
                    minMove: 1,
                },
                // v4 supports curveType: 1 for smooth curves
                // If it's v3, this might be ignored, but it's safe to add
                // @ts-ignore
                curveType: 1,
            });

            const formattedData = sortedData.map(d => {
                let val = d.totalValue;
                if (mode === 'percent' && firstValue !== 0) {
                    val = ((d.totalValue - firstValue) / firstValue) * 100;
                }
                return {
                    time: d.date,
                    value: val,
                };
            });

            series.setData(formattedData);

            // Set Markers for Notes
            const markers = sortedData
                .filter(d => d.note && d.note.trim() !== '')
                .map(d => ({
                    time: d.date,
                    position: 'aboveBar' as const,
                    color: '#f59e0b', // Amber
                    shape: 'circle' as const,
                    text: d.note,
                }));

            if (markers.length > 0) {
                series.setMarkers(markers);
            }

            chart.timeScale().fitContent();
        };

        initChart();

        const handleResize = () => {
            if (chart && chartContainerRef.current) {
                chart.applyOptions({ width: chartContainerRef.current.clientWidth });
            }
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            if (chart) {
                chart.remove();
                chart = null;
            }
        };
    }, [data, darkMode, mode]);

    if (data.length === 0) {
        return (
            <div className="chart-empty-state" style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
                <span>No history data available yet.</span>
            </div>
        );
    }

    return (
        <div className="trend-chart-wrapper" style={{ width: '100%' }}>
            <div ref={chartContainerRef} className="chart-canvas-container" style={{ borderRadius: '8px', overflow: 'hidden' }} />
        </div>
    );
};
