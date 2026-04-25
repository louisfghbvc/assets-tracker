import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../db/database';
import { sellAsset } from '../portfolio';

const makeAsset = (overrides: Partial<Parameters<typeof db.assets.add>[0]> = {}) => ({
    recordId: `test-${Math.random().toString(36).slice(2)}`,
    symbol: 'AAPL',
    name: 'Apple',
    type: 'stock' as const,
    market: 'US' as const,
    quantity: 100,
    cost: 150,
    lastUpdated: Date.now(),
    source: 'manual' as const,
    ...overrides,
});

beforeEach(async () => {
    await db.assets.clear();
    await db.sellRecords.clear();
});

describe('sellAsset — partial sell', () => {
    it('creates SellRecord, reduces quantity, preserves per-unit cost', async () => {
        const id = await db.assets.add(makeAsset({ quantity: 100, cost: 150 }));

        await sellAsset({ assetId: id, soldQuantity: 40, sellPrice: 200, sellDate: Date.now(), exchangeRateAtSale: 32 });

        const remaining = await db.assets.get(id);
        expect(remaining?.quantity).toBe(60);
        expect(remaining?.cost).toBe(150); // per-unit cost unchanged

        const records = await db.sellRecords.toArray();
        expect(records).toHaveLength(1);
        expect(records[0].soldQuantity).toBe(40);
        expect(records[0].avgCostAtSale).toBe(150);
    });
});

describe('sellAsset — full sell', () => {
    it('creates SellRecord and deletes Asset record', async () => {
        const id = await db.assets.add(makeAsset({ quantity: 50, cost: 100 }));

        await sellAsset({ assetId: id, soldQuantity: 50, sellPrice: 120, sellDate: Date.now(), exchangeRateAtSale: 32 });

        const gone = await db.assets.get(id);
        expect(gone).toBeUndefined();

        const records = await db.sellRecords.toArray();
        expect(records).toHaveLength(1);
    });
});

describe('sellAsset — realizedGain', () => {
    it('computes correctly when sellPrice > avgCost (gain), fees subtracted', async () => {
        const id = await db.assets.add(makeAsset({ quantity: 10, cost: 100 }));

        const record = await sellAsset({ assetId: id, soldQuantity: 10, sellPrice: 150, sellDate: Date.now(), fees: 5, exchangeRateAtSale: 32 });

        // (150 - 100) * 10 - 5 = 495
        expect(record.realizedGain).toBe(495);
    });

    it('computes correctly when sellPrice < avgCost (loss), fees subtracted', async () => {
        const id = await db.assets.add(makeAsset({ quantity: 10, cost: 100 }));

        const record = await sellAsset({ assetId: id, soldQuantity: 10, sellPrice: 80, sellDate: Date.now(), fees: 5, exchangeRateAtSale: 32 });

        // (80 - 100) * 10 - 5 = -205
        expect(record.realizedGain).toBe(-205);
    });

    it('treats fees=undefined as 0', async () => {
        const id = await db.assets.add(makeAsset({ quantity: 10, cost: 100 }));

        const record = await sellAsset({ assetId: id, soldQuantity: 10, sellPrice: 120, sellDate: Date.now(), exchangeRateAtSale: 32 });

        // (120 - 100) * 10 - 0 = 200
        expect(record.realizedGain).toBe(200);
    });
});

describe('sellAsset — realizedGainTWD aggregation', () => {
    it('TW market: realizedGainTWD is undefined', async () => {
        const id = await db.assets.add(makeAsset({ market: 'TW', cost: 600, quantity: 1 }));

        const record = await sellAsset({ assetId: id, soldQuantity: 1, sellPrice: 700, sellDate: Date.now() });

        expect(record.realizedGainTWD).toBeUndefined();
        expect(record.realizedGain).toBe(100); // fallback used in aggregation
    });

    it('US market: realizedGainTWD = realizedGain × exchangeRateAtSale', async () => {
        const id = await db.assets.add(makeAsset({ market: 'US', cost: 100, quantity: 10 }));

        const record = await sellAsset({ assetId: id, soldQuantity: 10, sellPrice: 120, sellDate: Date.now(), exchangeRateAtSale: 32 });

        expect(record.realizedGain).toBe(200);
        expect(record.realizedGainTWD).toBe(200 * 32); // 6400
    });

    it('Crypto market: realizedGainTWD computed same as US', async () => {
        const id = await db.assets.add(makeAsset({ market: 'Crypto', symbol: 'BTC-USD', type: 'crypto', cost: 50000, quantity: 1 }));

        const record = await sellAsset({ assetId: id, soldQuantity: 1, sellPrice: 60000, sellDate: Date.now(), exchangeRateAtSale: 32 });

        expect(record.realizedGain).toBe(10000);
        expect(record.realizedGainTWD).toBe(10000 * 32);
    });
});

describe('sellAsset — holdingDays', () => {
    it('computed correctly when purchaseDate is set', async () => {
        const purchaseDate = Date.now() - 30 * 86400000; // 30 days ago
        const id = await db.assets.add(makeAsset({ purchaseDate }));
        const sellDate = Date.now();

        const record = await sellAsset({ assetId: id, soldQuantity: 1, sellPrice: 200, sellDate, exchangeRateAtSale: 32 });

        expect(record.holdingDays).toBe(30);
    });

    it('holdingDays is undefined (not NaN) when purchaseDate is not set', async () => {
        const id = await db.assets.add(makeAsset({ purchaseDate: undefined }));

        const record = await sellAsset({ assetId: id, soldQuantity: 1, sellPrice: 200, sellDate: Date.now(), exchangeRateAtSale: 32 });

        expect(record.holdingDays).toBeUndefined();
    });
});

describe('sellAsset — validation', () => {
    it('throws ValidationError when soldQty > currentQty at tx time', async () => {
        const id = await db.assets.add(makeAsset({ quantity: 10 }));

        await expect(
            sellAsset({ assetId: id, soldQuantity: 20, sellPrice: 200, sellDate: Date.now(), exchangeRateAtSale: 32 })
        ).rejects.toThrow('數量超過持倉');
    });

    it('leaves DB unchanged when validation fails (atomicity)', async () => {
        const id = await db.assets.add(makeAsset({ quantity: 10 }));

        try {
            await sellAsset({ assetId: id, soldQuantity: 20, sellPrice: 200, sellDate: Date.now(), exchangeRateAtSale: 32 });
        } catch { /* expected */ }

        const asset = await db.assets.get(id);
        expect(asset?.quantity).toBe(10); // unchanged

        const records = await db.sellRecords.toArray();
        expect(records).toHaveLength(0); // no record written
    });
});
