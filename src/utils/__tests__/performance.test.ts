import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    annualizedReturn,
    portfolioAnnualizedReturn,
    benchmarkAnnualizedReturn,
    portfolioHoldingDays,
    portfolioStartDate,
    groupedAssetReturns,
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

    it('uses 32.5 fallback when exchangeRate is 0 for US market', () => {
        const a = makeAsset({ market: 'US', cost: 100, currentPrice: 200, quantity: 1, purchaseDate: daysAgo(365) });
        const withZero = portfolioAnnualizedReturn([a], 0);
        const withDefault = portfolioAnnualizedReturn([a], 32.5);
        expect(withZero.value).toBeCloseTo(withDefault.value!, 10);
    });

    it('excludes asset with cost 0 from calculation', () => {
        const a = makeAsset({ cost: 0, currentPrice: 150, purchaseDate: daysAgo(365) });
        const { value, excludedCount } = portfolioAnnualizedReturn([a], 32.5);
        expect(value).toBeNull();
        expect(excludedCount).toBe(1);
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

// ──────────────────────────────────────────────
// groupedAssetReturns
// ──────────────────────────────────────────────
describe('groupedAssetReturns', () => {
    it('groups two lots of the same symbol+market into one row', () => {
        const lot1 = makeAsset({ id: 1, symbol: 'AAPL', market: 'US' });
        const lot2 = makeAsset({ id: 2, symbol: 'AAPL', market: 'US', cost: 120, quantity: 5 });
        const result = groupedAssetReturns([lot1, lot2], 32);
        expect(result).toHaveLength(1);
        expect(result[0].symbol).toBe('AAPL');
    });

    it('keeps same symbol in different markets as separate rows', () => {
        const tw = makeAsset({ id: 1, symbol: 'AAPL', market: 'TW' });
        const us = makeAsset({ id: 2, symbol: 'AAPL', market: 'US' });
        const result = groupedAssetReturns([tw, us], 32);
        expect(result).toHaveLength(2);
    });

    it('uses earliest purchaseDate for holdingDays', () => {
        const older = makeAsset({ id: 1, purchaseDate: daysAgo(400) });
        const newer = makeAsset({ id: 2, purchaseDate: daysAgo(200) });
        const result = groupedAssetReturns([older, newer], 32);
        expect(result[0].holdingDays).toBe(400);
    });

    it('computes market-value-weighted CAGR across lots', () => {
        // lot1: cost=100, price=200, 365d → 100% return, mktValue=2000
        const lot1 = makeAsset({ id: 1, cost: 100, currentPrice: 200, quantity: 10, purchaseDate: daysAgo(365) });
        // lot2: cost=100, price=100, 365d → 0% return, mktValue=1000
        const lot2 = makeAsset({ id: 2, cost: 100, currentPrice: 100, quantity: 10, purchaseDate: daysAgo(365) });
        const result = groupedAssetReturns([lot1, lot2], 32);
        // weighted = (1.0 * 2000 + 0 * 1000) / 3000
        expect(result[0].annReturn).toBeCloseTo(2000 / 3000, 4);
    });

    it('sums P&L across lots in TWD for TW market', () => {
        const lot1 = makeAsset({ id: 1, market: 'TW', cost: 100, currentPrice: 150, quantity: 10 });
        const lot2 = makeAsset({ id: 2, market: 'TW', cost: 100, currentPrice: 80, quantity: 5 });
        const result = groupedAssetReturns([lot1, lot2], 32);
        // (150-100)*10 + (80-100)*5 = 500 - 100 = 400 TWD
        expect(result[0].pnlTWD).toBeCloseTo(400, 1);
    });

    it('applies exchangeRate to US lot P&L', () => {
        const a = makeAsset({ id: 1, market: 'US', cost: 100, currentPrice: 110, quantity: 10 });
        const result = groupedAssetReturns([a], 32);
        // (110-100)*10*32 = 3200 TWD
        expect(result[0].pnlTWD).toBeCloseTo(3200, 1);
    });

    it('returns annReturn null for group with no dated lots', () => {
        const a = makeAsset({ purchaseDate: undefined });
        const result = groupedAssetReturns([a], 32);
        expect(result[0].annReturn).toBeNull();
    });

    it('hasCostData is false when no lot has both currentPrice and cost', () => {
        const a = makeAsset({ cost: 0, currentPrice: 0 });
        const result = groupedAssetReturns([a], 32);
        expect(result[0].hasCostData).toBe(false);
    });

    it('sorts by annReturn descending, nulls last', () => {
        const a = makeAsset({ id: 1, symbol: 'AAA', cost: 100, currentPrice: 200, quantity: 1, purchaseDate: daysAgo(365) });
        const b = makeAsset({ id: 2, symbol: 'BBB', cost: 100, currentPrice: 110, quantity: 1, purchaseDate: daysAgo(365) });
        const c = makeAsset({ id: 3, symbol: 'CCC', purchaseDate: undefined });
        const result = groupedAssetReturns([b, c, a], 32);
        expect(result[0].symbol).toBe('AAA');
        expect(result[1].symbol).toBe('BBB');
        expect(result[2].symbol).toBe('CCC');
    });

    it('shortHolding is true when earliest purchaseDate < 30 days ago', () => {
        const a = makeAsset({ purchaseDate: daysAgo(10) });
        const result = groupedAssetReturns([a], 32);
        expect(result[0].shortHolding).toBe(true);
    });

    it('shortHolding uses earliest date, not latest', () => {
        // one lot old, one lot very new — earliest is old → not short
        const old = makeAsset({ id: 1, purchaseDate: daysAgo(200) });
        const fresh = makeAsset({ id: 2, purchaseDate: daysAgo(5) });
        const result = groupedAssetReturns([old, fresh], 32);
        expect(result[0].shortHolding).toBe(false);
    });

    it('returns empty array for empty assets input', () => {
        expect(groupedAssetReturns([], 32)).toHaveLength(0);
    });

    it('computes negative pnlTWD for a loss position', () => {
        const a = makeAsset({ id: 1, market: 'US', cost: 150, currentPrice: 100, quantity: 10 });
        const result = groupedAssetReturns([a], 32);
        expect(result[0].pnlTWD).toBeCloseTo((100 - 150) * 10 * 32, 1);
        expect(result[0].pnlTWD).toBeLessThan(0);
    });

    it('hasCostData true even when only one lot in group has cost data', () => {
        const valid = makeAsset({ id: 1, market: 'TW', cost: 100, currentPrice: 150, quantity: 10 });
        const invalid = makeAsset({ id: 2, market: 'TW', cost: 0, currentPrice: 0, quantity: 5 });
        const result = groupedAssetReturns([valid, invalid], 32);
        expect(result[0].hasCostData).toBe(true);
        // P&L only from the valid lot (TW market, rate=1)
        expect(result[0].pnlTWD).toBeCloseTo((150 - 100) * 10, 1);
    });

    it('shortHolding is false at exactly 30 days (boundary: < 30, not <=)', () => {
        const a = makeAsset({ purchaseDate: daysAgo(30) });
        const result = groupedAssetReturns([a], 32);
        expect(result[0].shortHolding).toBe(false);
    });

    it('uses 32.5 fallback when exchangeRate is 0 for US market P&L', () => {
        const a = makeAsset({ id: 1, market: 'US', cost: 100, currentPrice: 110, quantity: 10 });
        const withZero = groupedAssetReturns([a], 0);
        const withDefault = groupedAssetReturns([a], 32.5);
        expect(withZero[0].pnlTWD).toBeCloseTo(withDefault[0].pnlTWD, 1);
    });

    it('computes weighted CAGR using only lots with valid annualizedReturn', () => {
        // lot with holdingDays < 1 → annualizedReturn returns null → excluded from weight
        const validLot = makeAsset({ id: 1, cost: 100, currentPrice: 200, quantity: 10, purchaseDate: daysAgo(365) });
        const sameDayLot = makeAsset({ id: 2, cost: 100, currentPrice: 110, quantity: 10, purchaseDate: NOW });
        const result = groupedAssetReturns([validLot, sameDayLot], 32);
        // only validLot contributes → annReturn ≈ 100%
        expect(result[0].annReturn).not.toBeNull();
        expect(result[0].annReturn!).toBeCloseTo(1.0, 2);
    });
});
