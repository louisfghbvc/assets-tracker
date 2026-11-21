import { StrictMode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TrendChart } from '../TrendChart';

const chartMocks = vi.hoisted(() => {
    const series = {
        setData: vi.fn(),
        coordinateToPrice: vi.fn(() => 100),
    };
    const timeScale = {
        fitContent: vi.fn(),
        coordinateToTime: vi.fn(() => '2026-01-01'),
        timeToCoordinate: vi.fn((time: string) => time === '2026-01-01' ? 10 : 50),
    };
    let crosshairHandler: ((event: { time?: string }) => void) | null = null;
    const chart = {
        addSeries: vi.fn(() => series),
        applyOptions: vi.fn(),
        clearCrosshairPosition: vi.fn(),
        remove: vi.fn(),
        setCrosshairPosition: vi.fn((_price: number, time: string) => {
            crosshairHandler?.({ time });
        }),
        subscribeCrosshairMove: vi.fn((handler: (event: { time?: string }) => void) => {
            crosshairHandler = handler;
        }),
        timeScale: vi.fn(() => timeScale),
        unsubscribeCrosshairMove: vi.fn(),
    };

    return {
        chart,
        createChart: vi.fn(() => chart),
        createSeriesMarkers: vi.fn(() => ({ detach: vi.fn(), setMarkers: vi.fn() })),
        series,
        timeScale,
    };
});

vi.mock('lightweight-charts', () => ({
    AreaSeries: 'AreaSeries',
    ColorType: { Solid: 'solid' },
    CrosshairMode: { Magnet: 1 },
    createChart: chartMocks.createChart,
    createSeriesMarkers: chartMocks.createSeriesMarkers,
}));

describe('TrendChart', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        chartMocks.timeScale.coordinateToTime.mockReturnValue('2026-01-01');
    });

    it('shows the latest saved snapshot, currency, and note', () => {
        render(
            <TrendChart
                data={[
                    { id: 1, date: '2026-01-01', totalValue: 1000, currency: 'TWD', note: 'Cash deposit' },
                    { id: 2, date: '2026-01-02', totalValue: 1250, currency: 'TWD', note: 'Weekly review' },
                ]}
                language="en"
            />,
        );

        expect(screen.getByText('Jan 2, 2026')).toBeInTheDocument();
        expect(screen.getByText('TWD 1,250')).toBeInTheDocument();
        expect(screen.getByText('TWD +250')).toBeInTheDocument();
        expect(screen.getByText('Asset change')).toBeInTheDocument();
        expect(screen.getByText('Weekly review')).toBeInTheDocument();
    });

    it('renders history after React StrictMode replays chart effects', async () => {
        const chartData = [
            { time: '2026-01-01', value: 1000 },
            { time: '2026-01-02', value: 1250 },
        ];
        render(
            <StrictMode>
                <TrendChart
                    data={[
                        { id: 1, date: '2026-01-01', totalValue: 1000, currency: 'TWD' },
                        { id: 2, date: '2026-01-02', totalValue: 1250, currency: 'TWD' },
                    ]}
                    language="en"
                />
            </StrictMode>,
        );

        await waitFor(() => expect(chartMocks.series.setData).toHaveBeenCalledWith(chartData));
        expect(chartMocks.timeScale.fitContent).toHaveBeenCalled();
    });

    it('passes saved note markers to the chart without skipping the full-range fit', async () => {
        render(
            <TrendChart
                data={[
                    { id: 1, date: '2026-01-01', totalValue: 1000, currency: 'TWD' },
                    { id: 2, date: '2026-01-02', totalValue: 1250, currency: 'TWD', note: 'Weekly review' },
                ]}
                language="en"
            />,
        );

        await waitFor(() => {
            expect(chartMocks.createSeriesMarkers).toHaveBeenCalledWith(chartMocks.series, [
                { time: '2026-01-02', position: 'aboveBar', color: '#f59e0b', shape: 'circle' },
            ]);
        });
        expect(chartMocks.series.setData).toHaveBeenCalledWith([
            { time: '2026-01-01', value: 1000 },
            { time: '2026-01-02', value: 1250 },
        ]);
        expect(chartMocks.timeScale.fitContent).toHaveBeenCalledTimes(1);
    });

    it('plots only the latest snapshot for each duplicate date', async () => {
        render(
            <TrendChart
                data={[
                    { id: 1, date: '2026-01-01', totalValue: 1000, currency: 'TWD' },
                    { id: 2, date: '2026-01-01', totalValue: 1050, currency: 'TWD' },
                    { id: 3, date: '2026-01-02', totalValue: 1250, currency: 'TWD' },
                ]}
                language="en"
            />,
        );

        await waitFor(() => {
            expect(chartMocks.series.setData).toHaveBeenCalledWith([
                { time: '2026-01-01', value: 1050 },
                { time: '2026-01-02', value: 1250 },
            ]);
        });
        expect(chartMocks.timeScale.fitContent).toHaveBeenCalledTimes(1);
    });

    it('lets a touch pointer select a saved date and value', () => {
        chartMocks.timeScale.coordinateToTime.mockReturnValue('2026-01-02');
        const { container } = render(
            <TrendChart
                data={[
                    { id: 1, date: '2026-01-01', totalValue: 1000, currency: 'TWD', note: 'Cash deposit' },
                    { id: 2, date: '2026-01-02', totalValue: 1250, currency: 'TWD' },
                ]}
                language="en"
            />,
        );
        const chart = container.querySelector('.chart-canvas-container');
        expect(chart).not.toBeNull();

        const touchMove = new Event('pointermove', { bubbles: true });
        Object.defineProperties(touchMove, {
            clientX: { value: 24 },
            clientY: { value: 32 },
            pointerType: { value: 'touch' },
        });
        act(() => chart!.dispatchEvent(touchMove));

        expect(screen.getByText('Jan 1, 2026')).toBeInTheDocument();
        expect(screen.getByText('TWD 1,000')).toBeInTheDocument();
        expect(screen.getByText('Cash deposit')).toBeInTheDocument();
        expect(chartMocks.chart.setCrosshairPosition).toHaveBeenCalled();
    });

    it('shows percentage change from the first snapshot without calling it a return', () => {
        render(
            <TrendChart
                data={[
                    { id: 1, date: '2026-01-01', totalValue: 1000, currency: 'TWD' },
                    { id: 2, date: '2026-01-02', totalValue: 1250, currency: 'TWD' },
                ]}
                language="en"
                mode="percent"
            />,
        );

        expect(screen.getByText('+25.00%')).toBeInTheDocument();
        expect(screen.getByText(/first snapshot in this range/)).toBeInTheDocument();
        expect(screen.getByText(/not an investment return/)).toBeInTheDocument();
    });

    it('shows one saved value without implying a period change', () => {
        render(
            <TrendChart
                data={[{ id: 1, date: '2026-01-01', totalValue: 1000, currency: 'TWD' }]}
                language="en"
            />,
        );

        expect(screen.getByText('TWD 1,000')).toBeInTheDocument();
        expect(screen.getByText('A change needs at least two saved snapshots.')).toBeInTheDocument();
        expect(screen.getByRole('group', { name: 'Asset history chart' })).toBeInTheDocument();
    });

    it('explains why percentage change is unavailable for a single snapshot', () => {
        render(
            <TrendChart
                data={[{ id: 1, date: '2026-01-01', totalValue: 1000, currency: 'TWD' }]}
                language="en"
                mode="percent"
            />,
        );

        expect(screen.getByText('TWD 1,000')).toBeInTheDocument();
        expect(screen.getByText('A change needs at least two saved snapshots.')).toBeInTheDocument();
        expect(document.querySelector('.chart-canvas-container')).toBeNull();
    });

    it('does not format a zero baseline as a percentage', () => {
        render(
            <TrendChart
                data={[
                    { id: 1, date: '2026-01-01', totalValue: 0, currency: 'TWD' },
                    { id: 2, date: '2026-01-02', totalValue: 1000, currency: 'TWD' },
                ]}
                language="en"
                mode="percent"
            />,
        );

        expect(screen.getByText('Asset change % needs a positive first snapshot.')).toBeInTheDocument();
        expect(document.querySelector('.chart-canvas-container')).toBeNull();
    });

    it('does not compare snapshots recorded in different currencies', () => {
        render(
            <TrendChart
                data={[
                    { id: 1, date: '2026-01-01', totalValue: 1000, currency: 'TWD' },
                    { id: 2, date: '2026-01-02', totalValue: 100, currency: 'USD' },
                ]}
                language="en"
            />,
        );

        expect(screen.getByText(/multiple currencies/)).toBeInTheDocument();
        expect(document.querySelector('.chart-canvas-container')).toBeNull();
    });

    it('supports keyboard selection of saved snapshots', () => {
        render(
            <TrendChart
                data={[
                    { id: 1, date: '2026-01-01', totalValue: 1000, currency: 'TWD' },
                    { id: 2, date: '2026-01-02', totalValue: 1250, currency: 'TWD' },
                ]}
                language="en"
            />,
        );

        const chart = screen.getByRole('group', { name: 'Asset history chart' });
        fireEvent.keyDown(chart, { key: 'ArrowLeft' });

        expect(screen.getByText('Jan 1, 2026')).toBeInTheDocument();
        expect(screen.getByText('TWD 1,000')).toBeInTheDocument();
    });

    it('shows a useful empty state instead of creating data', () => {
        render(<TrendChart data={[]} language="en" />);

        expect(screen.getByText('No saved snapshots in this range. Only saved history is plotted.')).toBeInTheDocument();
        expect(document.querySelector('.chart-canvas-container')).toBeNull();
    });
});
