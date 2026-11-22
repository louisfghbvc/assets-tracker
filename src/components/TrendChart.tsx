import { useEffect, useMemo, useRef, useState } from 'react';
import type { FC, KeyboardEvent } from 'react';
import {
    AreaSeries,
    ColorType,
    CrosshairMode,
    createChart,
    type IChartApi,
    type ISeriesApi,
    type Time,
} from 'lightweight-charts';
import type { HistoryRecord } from '../db/database';
import { translations, type Language } from '../translations';

interface TrendChartProps {
    data: HistoryRecord[];
    darkMode?: boolean;
    mode?: 'value' | 'percent';
    language: Language;
    hideValues?: boolean;
}

type ChartAvailability =
    | { kind: 'empty' }
    | { kind: 'ready'; currency: string; baseline: number }
    | { kind: 'unavailable'; reason: 'mixed-currency' | 'insufficient-history' | 'non-positive-baseline' };

function determineChartAvailability(data: HistoryRecord[], mode: 'value' | 'percent'): ChartAvailability {
    if (data.length === 0) return { kind: 'empty' };

    const currency = data[0].currency;
    if (data.some((record) => record.currency !== currency)) {
        return { kind: 'unavailable', reason: 'mixed-currency' };
    }

    if (mode === 'percent') {
        if (data.length < 2) return { kind: 'unavailable', reason: 'insufficient-history' };
        if (data[0].totalValue <= 0) return { kind: 'unavailable', reason: 'non-positive-baseline' };
    }

    return { kind: 'ready', currency, baseline: data[0].totalValue };
}

function dateFromChartTime(time: Time | undefined): string | null {
    if (typeof time === 'string') return time;
    if (typeof time === 'number') return new Date(time * 1000).toISOString().slice(0, 10);
    if (time && typeof time === 'object') {
        const month = String(time.month).padStart(2, '0');
        const day = String(time.day).padStart(2, '0');
        return `${time.year}-${month}-${day}`;
    }
    return null;
}

function formatDate(date: string, locale: string): string {
    return new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeZone: 'UTC',
    }).format(new Date(`${date}T00:00:00Z`));
}

function formatAmount(value: number, currency: string, locale: string, signed = false): string {
    const formatted = new Intl.NumberFormat(locale, {
        maximumFractionDigits: 0,
        signDisplay: signed ? 'always' : 'auto',
    }).format(value);
    return `${currency} ${formatted}`;
}

function formatPercent(value: number, locale: string): string {
    return `${new Intl.NumberFormat(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        signDisplay: 'always',
    }).format(value)}%`;
}

export const TrendChart: FC<TrendChartProps> = ({
    data,
    darkMode = true,
    mode = 'value',
    language,
    hideValues = false,
}) => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi<'Area'> | null>(null);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const locale = language === 'zh' ? 'zh-TW' : 'en-US';
    const t = translations[language];

    const sortedData = useMemo(() => {
        const byDate = new Map<string, HistoryRecord>();
        [...data]
            .sort((left, right) => left.date.localeCompare(right.date))
            .forEach((record) => byDate.set(record.date, record));
        return [...byDate.values()];
    }, [data]);
    const recordsByDate = useMemo(
        () => new Map(sortedData.map((record) => [record.date, record])),
        [sortedData],
    );
    const availability = determineChartAvailability(sortedData, mode);
    const selectedRecord = sortedData.find((record) => record.date === selectedDate)
        ?? sortedData[sortedData.length - 1]
        ?? null;

    useEffect(() => {
        setSelectedDate(sortedData[sortedData.length - 1]?.date ?? null);
    }, [sortedData]);

    const canRenderChart = availability.kind === 'ready';
    const chartCurrency = availability.kind === 'ready' ? availability.currency : '';
    const baseline = availability.kind === 'ready' ? availability.baseline : 0;

    useEffect(() => {
        const container = chartContainerRef.current;
        if (!container || !canRenderChart) return;

        const chart = createChart(container, {
            layout: {
                background: { type: ColorType.Solid, color: 'transparent' },
                textColor: darkMode ? 'rgba(255, 255, 255, 0.72)' : '#333333',
                fontSize: 11,
            },
            localization: { locale },
            grid: {
                vertLines: { color: darkMode ? 'rgba(255, 255, 255, 0.04)' : '#eeeeee' },
                horzLines: { color: darkMode ? 'rgba(255, 255, 255, 0.08)' : '#e5e7eb' },
            },
            width: Math.max(container.clientWidth, 1),
            height: Math.max(container.clientHeight, 220),
            timeScale: {
                borderVisible: false,
                timeVisible: false,
                secondsVisible: false,
                fixLeftEdge: true,
                fixRightEdge: true,
            },
            rightPriceScale: {
                borderVisible: false,
                autoScale: true,
                visible: !hideValues,
            },
            handleScroll: false,
            handleScale: false,
            crosshair: {
                mode: CrosshairMode.Magnet,
                vertLine: { labelBackgroundColor: '#3b82f6' },
                horzLine: { labelBackgroundColor: '#3b82f6' },
            },
        });
        chartRef.current = chart;

        const series = chart.addSeries(AreaSeries, {
            lineColor: '#3b82f6',
            topColor: 'rgba(59, 130, 246, 0.28)',
            bottomColor: 'rgba(59, 130, 246, 0.02)',
            lineWidth: 2,
            pointMarkersVisible: sortedData.length === 1,
            pointMarkersRadius: 4,
            priceFormat: {
                type: 'custom',
                minMove: mode === 'percent' ? 0.01 : 1,
                formatter: (price: number) => mode === 'percent'
                    ? `${price.toFixed(2)}%`
                    : `${chartCurrency} ${new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(price)}`,
            },
        });
        seriesRef.current = series;

        const chartData = sortedData.map((record) => ({
            time: record.date,
            value: mode === 'percent'
                ? ((record.totalValue - baseline) / baseline) * 100
                : record.totalValue,
        }));
        series.setData(chartData);

        const handleCrosshairMove = (param: { time?: Time }) => {
            const date = dateFromChartTime(param.time);
            if (date && recordsByDate.has(date)) setSelectedDate(date);
        };
        chart.subscribeCrosshairMove(handleCrosshairMove);

        const handleTouchPointer = (event: PointerEvent) => {
            if (event.pointerType !== 'touch') return;
            const bounds = container.getBoundingClientRect();
            const x = event.clientX - bounds.left;
            const nearestSnapshot = sortedData.reduce<{
                record: HistoryRecord;
                distance: number;
            } | null>((nearest, record) => {
                const coordinate = chart.timeScale().timeToCoordinate(record.date);
                if (coordinate === null) return nearest;
                const distance = Math.abs(coordinate - x);
                return !nearest || distance < nearest.distance ? { record, distance } : nearest;
            }, null);
            if (!nearestSnapshot) return;

            const record = nearestSnapshot.record;
            const value = mode === 'percent'
                ? ((record.totalValue - baseline) / baseline) * 100
                : record.totalValue;
            chart.setCrosshairPosition(value, record.date, series);
            setSelectedDate(record.date);
        };
        const handleTouchEnd = (event: PointerEvent) => {
            if (event.pointerType === 'touch') chart.clearCrosshairPosition();
        };
        container.addEventListener('pointerdown', handleTouchPointer);
        container.addEventListener('pointermove', handleTouchPointer);
        container.addEventListener('pointerup', handleTouchEnd);
        container.addEventListener('pointercancel', handleTouchEnd);

        chart.timeScale().fitContent();

        const handleResize = () => {
            if (chartRef.current === chart && chartContainerRef.current) {
                chart.applyOptions({
                    width: Math.max(chartContainerRef.current.clientWidth, 1),
                    height: Math.max(chartContainerRef.current.clientHeight, 220),
                });
            }
        };
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            container.removeEventListener('pointerdown', handleTouchPointer);
            container.removeEventListener('pointermove', handleTouchPointer);
            container.removeEventListener('pointerup', handleTouchEnd);
            container.removeEventListener('pointercancel', handleTouchEnd);
            chart.unsubscribeCrosshairMove(handleCrosshairMove);
            chart.remove();
            if (chartRef.current === chart) chartRef.current = null;
            if (seriesRef.current === series) seriesRef.current = null;
        };
    }, [baseline, canRenderChart, chartCurrency, darkMode, hideValues, locale, mode, recordsByDate, sortedData]);

    if (sortedData.length === 0) {
        return (
            <div className="chart-empty-state trend-chart-empty" role="status">
                {t.chartNoHistory}
            </div>
        );
    }

    const selectedDelta = availability.kind === 'ready'
        && sortedData.length > 1
        && selectedRecord
        ? selectedRecord.totalValue - baseline
        : null;
    const selectedPercent = selectedDelta !== null && baseline > 0
        ? (selectedDelta / baseline) * 100
        : null;
    const displayedChange = hideValues
        ? '••••'
        : mode === 'percent'
            ? selectedPercent === null ? '—' : formatPercent(selectedPercent, locale)
            : selectedDelta === null ? '—' : formatAmount(selectedDelta, selectedRecord?.currency ?? '', locale, true);

    const unavailableMessage = availability.kind === 'unavailable'
        ? {
            'mixed-currency': t.chartMixedCurrency,
            'insufficient-history': t.chartSingleSnapshot,
            'non-positive-baseline': t.chartNonPositiveBaseline,
        }[availability.reason]
        : null;

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        const currentIndex = sortedData.findIndex((record) => record.date === selectedRecord?.date);
        const nextIndex = Math.min(
            Math.max(currentIndex + (event.key === 'ArrowRight' ? 1 : -1), 0),
            sortedData.length - 1,
        );
        const nextRecord = sortedData[nextIndex];
        if (!nextRecord) return;
        setSelectedDate(nextRecord.date);

        const chart = chartRef.current;
        const series = seriesRef.current;
        if (chart && series && availability.kind === 'ready') {
            const value = mode === 'percent'
                ? ((nextRecord.totalValue - baseline) / baseline) * 100
                : nextRecord.totalValue;
            chart.setCrosshairPosition(value, nextRecord.date, series);
        }
    };

    return (
        <div className="trend-chart-wrapper">
            {selectedRecord && (
                <div className="trend-chart-readout" role="status" aria-live="polite" aria-atomic="true">
                    <div className="trend-chart-readout-item">
                        <span className="trend-chart-readout-label">{t.date}</span>
                        <time dateTime={selectedRecord.date}>{formatDate(selectedRecord.date, locale)}</time>
                    </div>
                    <div className="trend-chart-readout-item">
                        <span className="trend-chart-readout-label">{t.value}</span>
                        <strong>{hideValues ? '••••' : formatAmount(selectedRecord.totalValue, selectedRecord.currency, locale)}</strong>
                    </div>
                    <div className="trend-chart-readout-item">
                        <span className="trend-chart-readout-label">{t.assetChange}</span>
                        <strong>{displayedChange}</strong>
                    </div>
                    {selectedRecord.note?.trim() && (
                        <p className="trend-chart-note">
                            <span>{t.noteLabel}: </span>{selectedRecord.note}
                        </p>
                    )}
                </div>
            )}

            {sortedData.length === 1 && mode === 'value' && (
                <div className="chart-empty-state trend-chart-message" role="status">
                    {t.chartSingleSnapshot}
                </div>
            )}

            {canRenderChart ? (
                <div
                    ref={chartContainerRef}
                    className="chart-canvas-container trend-chart-canvas"
                    role="group"
                    tabIndex={0}
                    aria-label={t.chartAccessibleLabel}
                    aria-describedby="trend-chart-keyboard-hint"
                    onKeyDown={handleKeyDown}
                />
            ) : (
                <div className="chart-empty-state trend-chart-message" role="status">
                    {unavailableMessage}
                </div>
            )}

            <p id="trend-chart-keyboard-hint" className="trend-chart-caption">
                {mode === 'percent' ? t.chartPercentDescription : t.chartChangeDescription}
                <span className="trend-chart-keyboard-hint">{t.chartKeyboardHint}</span>
            </p>
        </div>
    );
};
