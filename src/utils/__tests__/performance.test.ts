import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    annualizedReturn,
    portfolioAnnualizedReturn,
    benchmarkAnnualizedReturn,
    portfolioHoldingDays,
    portfolioStartDate,
} from '../performance';
import type { Asset } from '../../db/database';

const NOW = 1745000000000; // fixed epoch for determinism

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
});
afterEach(() => {
    vi.useRealTimers();
});

function daysAgo(n: number) {
    return NOW - n * 86400000;
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
        lastUpdated: NOW,
        source: 'manual',
        purchaseDate: daysAgo(365),
        ...overrides,
    };
}

// ──────────────────────────────────────────────
// annualizedReturn
// ──────────────────────────────────────────────
describe('annualizedReturn', () => {
    it('returns null for same-day purchase (holdingDays < 1)', () => {
        expect(annualizedReturn(100, 150, NOW)).toBeNull();
    });

    it('returns null when purchaseDate is 0', () => {
        expect(annualizedReturn(100, 150, 0)).toBeNull();
    });

    it('returns null when cost is 0', () => {
        expect(annualizedReturn(0, 150, daysAgo(100))).toBeNull();
    });

    it('returns null when cost is negative', () => {
        expect(annualizedReturn(-1, 150, daysAgo(100))).toBeNull();
    });

    it('returns null when currentPrice is 0', () => {
        expect(annualizedReturn(100, 0, daysAgo(100))).toBeNull();
    });

    it('returns positive annualized return for profitable position', () => {
        // cost=100, price=200, held exactly 365 days → 100% = 1.0
        const result = annualizedReturn(100, 200, daysAgo(365));
        expect(result).not.toBeNull();
        expect(result!).toBeCloseTo(1.0, 4);
    });

    it('returns negative annualized return when price < cost', () => {
        const result = annualizedReturn(100, 80, daysAgo(365));
        expect(result).not.toBeNull();
        expect(result!).toBeCloseTo(-0.2, 4);
    });

    it('returns a value (not null) for holdings < 30 days — caller renders warning', () => {
        const result = annualizedReturn(100, 110, daysAgo(15));
        expect(result).not.toBeNull();
    });

    it('produces reasonable annualized return for 3+ year holding', () => {
        // cost=100, price=200, held 1095 days (3 years) → ~26% annualized
        const result = annualizedReturn(100, 200, daysAgo(1095));
        expect(result).not.toBeNull();
        expect(result!).toBeCloseTo(0.2599, 2);
    });
});

// ──────────────────────────────────────────────
// portfolioAnnualizedReturn
// ──────────────────────────────────────────────
describe('portfolioAnnualizedReturn', () => {
    it('returns null when all assets lack purchaseDate', () => {
        const assets = [makeAsset({ purchaseDate: undefined }), makeAsset({ purchaseDate: 0 })];
        const { value, excludedCount } = portfolioAnnualizedReturn(assets, 32.5);
        expect(value).toBeNull();
        expect(excludedCount).toBe(2);
    });

    it('returns null when all currentPrice are 0', () => {
        const assets = [makeAsset({ currentPrice: 0 }), makeAsset({ currentPrice: undefined })];
        const { value } = portfolioAnnualizedReturn(assets, 32.5);
        expect(value).toBeNull();
    });

    it('computes correct return for single TW stock', () => {
        // TW market, multiplied by 1
        const a = makeAsset({ market: 'TW', cost: 100, currentPrice: 200, quantity: 1, purchaseDate: daysAgo(365) });
        const { value } = portfolioAnnualizedReturn([a], 32.5);
        expect(value).not.toBeNull();
        expect(value!).toBeCloseTo(1.0, 4);
    });

    it('applies exchangeRate for US stocks to normalize to TWD', () => {
        const rate = 32;
        // One TW stock: 100% return, mktValue 100 TWD
        const tw = makeAsset({ market: 'TW', cost: 100, currentPrice: 200, quantity: 1, purchaseDate: daysAgo(365) });
        // One US stock: 0% return, mktValue 100 USD = 3200 TWD → dominates
        const us = makeAsset({ id: 2, market: 'US', cost: 100, currentPrice: 100, quantity: 1, purchaseDate: daysAgo(365) });
        const { value } = portfolioAnnualizedReturn([tw, us], rate);
        // weighted: (1.0 * 200 + 0 * 3200) / (200 + 3200) ≈ 0.059
        expect(value).not.toBeNull();
        expect(value!).toBeCloseTo(200 / (200 + 3200), 3);
    });

    it('counts excluded assets correctly', () => {
        const a = makeAsset({ purchaseDate: undefined });
        const b = makeAsset({ id: 2, purchaseDate: daysAgo(365) });
        const { excludedCount } = portfolioAnnualizedReturn([a, b], 32.5);
        expect(excludedCount).toBe(1);
    });

    it('returns null when total TWD market value is below 0.01', () => {
        const a = makeAsset({ quantity: 0, currentPrice: 0 });
        const { value } = portfolioAnnualizedReturn([a], 32.5);
        expect(value).toBeNull();
    });
});

// ──────────────────────────────────────────────
// benchmarkAnnualizedReturn
// ──────────────────────────────────────────────
describe('benchmarkAnnualizedReturn', () => {
    it('returns null when holdingDays < 1', () => {
        expect(benchmarkAnnualizedReturn(100, 110, 0)).toBeNull();
    });

    it('returns null when startPrice is 0', () => {
        expect(benchmarkAnnualizedReturn(0, 110, 365)).toBeNull();
    });

    it('computes correct annualized return for 1-year holding', () => {
        const result = benchmarkAnnualizedReturn(100, 200, 365);
        expect(result).not.toBeNull();
        expect(result!).toBeCloseTo(1.0, 4);
    });

    it('returns null when currentPrice is 0', () => {
        expect(benchmarkAnnualizedReturn(100, 0, 365)).toBeNull();
    });
});

// ──────────────────────────────────────────────
// portfolioHoldingDays / portfolioStartDate
// ──────────────────────────────────────────────
describe('portfolioHoldingDays', () => {
    it('returns 0 when no assets have purchaseDate', () => {
        expect(portfolioHoldingDays([makeAsset({ purchaseDate: undefined })])).toBe(0);
    });

    it('uses earliest purchaseDate among all assets', () => {
        const assets = [
            makeAsset({ purchaseDate: daysAgo(200) }),
            makeAsset({ id: 2, purchaseDate: daysAgo(500) }),
        ];
        expect(portfolioHoldingDays(assets)).toBe(500);
    });
});

describe('portfolioStartDate', () => {
    it('returns null when no assets have purchaseDate', () => {
        expect(portfolioStartDate([makeAsset({ purchaseDate: undefined })])).toBeNull();
    });

    it('returns the earliest purchaseDate ms', () => {
        const early = daysAgo(500);
        const assets = [makeAsset({ purchaseDate: daysAgo(200) }), makeAsset({ id: 2, purchaseDate: early })];
        expect(portfolioStartDate(assets)).toBe(early);
    });
});
