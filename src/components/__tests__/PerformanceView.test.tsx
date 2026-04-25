import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PerformanceView } from '../PerformanceView';
import type { Asset } from '../../db/database';

// Mock Dexie db
vi.mock('../../db/database', async () => {
    const actual = await vi.importActual<typeof import('../../db/database')>('../../db/database');
    return {
        ...actual,
        db: {
            assets: {
                update: vi.fn().mockResolvedValue(1),
            },
        },
    };
});

// Module-level mock — each test overrides as needed
vi.mock('../../services/price', () => ({
    priceService: {
        fetchBenchmarkPrice: vi.fn().mockResolvedValue(null),
    },
}));

function daysAgo(n: number) {
    return Date.now() - n * 86400000;
}

function makeAsset(overrides: Partial<Asset> = {}): Asset {
    return {
        id: 1,
        recordId: 'rec1',
        symbol: 'AAPL',
        name: 'Apple',
        type: 'stock',
        market: 'US',
        quantity: 10,
        cost: 100,
        currentPrice: 150,
        lastUpdated: Date.now(),
        source: 'manual',
        purchaseDate: daysAgo(400), // >30 days, no short-holding warning
        ...overrides,
    };
}

const defaultProps = {
    assets: [makeAsset()],
    exchangeRate: 32,
    language: 'en' as const,
    hideValues: false,
};

beforeEach(() => {
    vi.clearAllMocks();
});

describe('PerformanceView', () => {
    describe('all assets missing purchaseDate — empty state', () => {
        it('shows setup card full-screen and empty state message', () => {
            const assets = [makeAsset({ purchaseDate: undefined }), makeAsset({ id: 2, purchaseDate: 0 })];
            render(<PerformanceView {...defaultProps} assets={assets} />);
            expect(screen.getByText(/Set Purchase Dates/i)).toBeInTheDocument();
            expect(screen.getByText(/Add purchase dates to calculate performance/i)).toBeInTheDocument();
        });

        it('save button is disabled when no dates entered', () => {
            const assets = [makeAsset({ purchaseDate: undefined })];
            render(<PerformanceView {...defaultProps} assets={assets} />);
            const btn = screen.getByText('Save All');
            expect(btn).toBeDisabled();
        });
    });

    describe('all assets have purchaseDate — full analytics', () => {
        it('renders portfolio summary card', () => {
            render(<PerformanceView {...defaultProps} />);
            // "Annualized Return" appears in both the summary card and the table header
            const labels = screen.getAllByText('Annualized Return');
            expect(labels.length).toBeGreaterThanOrEqual(1);
            expect(screen.getByText('Holding Period')).toBeInTheDocument();
        });

        it('renders asset performance table', () => {
            render(<PerformanceView {...defaultProps} />);
            expect(screen.getByText(/Asset Performance Ranking/i)).toBeInTheDocument();
            expect(screen.getByText('AAPL')).toBeInTheDocument();
        });

        it('renders benchmark section', () => {
            render(<PerformanceView {...defaultProps} />);
            expect(screen.getByText(/Benchmark/i)).toBeInTheDocument();
            expect(screen.getByText('台灣加權指數 (TAIEX)')).toBeInTheDocument();
            expect(screen.getByText('標普500 (SPY)')).toBeInTheDocument();
        });
    });

    describe('mixed — some assets have purchaseDate, some do not', () => {
        it('shows setup section at top AND analytics below', () => {
            const assets = [
                makeAsset({ purchaseDate: daysAgo(400) }),
                makeAsset({ id: 2, symbol: 'NVDA', purchaseDate: undefined }),
            ];
            render(<PerformanceView {...defaultProps} assets={assets} />);
            expect(screen.getByText(/Set Purchase Dates/i)).toBeInTheDocument();
            const labels = screen.getAllByText('Annualized Return');
            expect(labels.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('asset performance table', () => {
        it('shows — for asset with no purchaseDate', () => {
            const assets = [
                makeAsset(),
                makeAsset({ id: 2, symbol: 'NVDA', purchaseDate: undefined }),
            ];
            render(<PerformanceView {...defaultProps} assets={assets} />);
            const cells = screen.getAllByText('—');
            expect(cells.length).toBeGreaterThan(0);
        });

        it('shows ⚠️ badge for holdings < 30 days', () => {
            const asset = makeAsset({ purchaseDate: daysAgo(10) });
            render(<PerformanceView {...defaultProps} assets={[asset]} />);
            expect(screen.getByTitle(/Holding < 30 days/i)).toBeInTheDocument();
        });

        it('hides values when hideValues=true', () => {
            render(<PerformanceView {...defaultProps} hideValues={true} />);
            const stars = screen.getAllByText('****');
            expect(stars.length).toBeGreaterThan(0);
        });
    });

    describe('benchmark section', () => {
        it('shows loading state initially', async () => {
            const { priceService } = await import('../../services/price');
            (priceService.fetchBenchmarkPrice as ReturnType<typeof vi.fn>).mockReturnValue(
                new Promise(() => {}) // never resolves
            );
            render(<PerformanceView {...defaultProps} />);
            const loaders = screen.getAllByText('...');
            expect(loaders.length).toBeGreaterThan(0);
        });

        it('shows retry button on error', async () => {
            const { priceService } = await import('../../services/price');
            (priceService.fetchBenchmarkPrice as ReturnType<typeof vi.fn>).mockResolvedValue(null);
            render(<PerformanceView {...defaultProps} />);
            await waitFor(() => {
                expect(screen.getAllByText('Retry').length).toBeGreaterThan(0);
            }, { timeout: 3000 });
        });

        it('shows Beating badge when portfolio beats index', async () => {
            const { priceService } = await import('../../services/price');
            // Portfolio: 150/100 over 400 days ≈ 43% annualized
            // Benchmark: 105/100 over 400 days ≈ 4.7% annualized → portfolio wins
            (priceService.fetchBenchmarkPrice as ReturnType<typeof vi.fn>).mockResolvedValue({
                startPrice: 100,
                currentPrice: 105,
            });
            render(<PerformanceView {...defaultProps} />);
            await waitFor(() => {
                const beating = screen.queryAllByText(/Beating/i);
                expect(beating.length).toBeGreaterThan(0);
            }, { timeout: 3000 });
        });

        it('retry button triggers re-fetch', async () => {
            const { priceService } = await import('../../services/price');
            (priceService.fetchBenchmarkPrice as ReturnType<typeof vi.fn>).mockResolvedValue(null);
            render(<PerformanceView {...defaultProps} />);
            await waitFor(() => {
                expect(screen.getAllByText('Retry').length).toBeGreaterThan(0);
            }, { timeout: 3000 });
            const callsBefore = (priceService.fetchBenchmarkPrice as ReturnType<typeof vi.fn>).mock.calls.length;
            fireEvent.click(screen.getAllByText('Retry')[0]);
            await waitFor(() => {
                expect((priceService.fetchBenchmarkPrice as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(callsBefore);
            }, { timeout: 3000 });
        });
    });

    describe('Chinese language', () => {
        it('renders Chinese labels when language=zh', () => {
            render(<PerformanceView {...defaultProps} language="zh" />);
            // multiple elements contain 績效 — just assert at least one exists
            expect(screen.getAllByText(/績效/).length).toBeGreaterThan(0);
            // 年化報酬率 appears in both summary card and table header
            expect(screen.getAllByText('年化報酬率').length).toBeGreaterThan(0);
        });
    });
});
