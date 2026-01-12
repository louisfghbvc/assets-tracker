import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PriceChart } from '../PriceChart';

// Mock lightweight-charts
vi.mock('lightweight-charts', () => ({
    createChart: vi.fn(() => ({
        applyOptions: vi.fn(),
        addCandlestickSeries: vi.fn(() => ({
            setData: vi.fn(),
        })),
        timeScale: vi.fn(() => ({
            fitContent: vi.fn(),
        })),
        remove: vi.fn(),
    })),
    ColorType: { Solid: 'solid' },
    CrosshairMode: { Normal: 0 },
}));

// Mock priceService
vi.mock('../../services/price', () => ({
    priceService: {
        fetchHistory: vi.fn().mockResolvedValue([
            { time: 1672531200, open: 100, high: 110, low: 90, close: 105, volume: 1000 }
        ]),
    },
}));

describe('PriceChart', () => {
    const mockProps = {
        symbol: 'AAPL',
        language: 'en' as const,
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render loading state initially', async () => {
        render(<PriceChart {...mockProps} />);
        expect(screen.getByText('Loading Chart...')).toBeInTheDocument();
    });

    it('should render range selector buttons', () => {
        render(<PriceChart {...mockProps} />);
        expect(screen.getByText('Daily')).toBeInTheDocument();
        expect(screen.getByText('Weekly')).toBeInTheDocument();
        expect(screen.getByText('Monthly')).toBeInTheDocument();
    });
});
