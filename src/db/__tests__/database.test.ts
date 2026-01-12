import { describe, it, expect, beforeEach } from 'vitest';
import { AssetTrackerDatabase } from '../database';

describe('AssetTrackerDatabase', () => {
    let testDb: AssetTrackerDatabase;

    beforeEach(() => {
        // Each test gets a fresh in-memory DB via fake-indexeddb
        testDb = new AssetTrackerDatabase();
    });

    it('should add and retrieve an asset', async () => {
        const asset = {
            recordId: 'uuid-1',
            symbol: 'AAPL',
            name: 'Apple',
            type: 'stock' as const,
            market: 'US' as const,
            quantity: 10,
            cost: 150,
            lastUpdated: Date.now(),
            source: 'manual' as const
        };

        const id = await testDb.assets.add(asset);
        expect(id).toBeDefined();

        const retrieved = await testDb.assets.get(id!);
        expect(retrieved?.symbol).toBe('AAPL');
        expect(retrieved?.recordId).toBe('uuid-1');
    });

    it('should query assets by market', async () => {
        await testDb.assets.bulkAdd([
            { recordId: '1', symbol: '2330.TW', name: 'TSMC', type: 'stock', market: 'TW', quantity: 1, cost: 600, lastUpdated: 0, source: 'manual' },
            { recordId: '2', symbol: 'AAPL', name: 'Apple', type: 'stock', market: 'US', quantity: 1, cost: 150, lastUpdated: 0, source: 'manual' },
            { recordId: '3', symbol: 'BTC-USD', name: 'Bitcoin', type: 'crypto', market: 'Crypto', quantity: 0.1, cost: 50000, lastUpdated: 0, source: 'manual' }
        ]);

        const twAssets = await testDb.assets.where('market').equals('TW').toArray();
        expect(twAssets).toHaveLength(1);
        expect(twAssets[0].symbol).toBe('2330.TW');
    });

    it('should clear all assets', async () => {
        await testDb.assets.add({ recordId: '1', symbol: 'AAPL', name: 'Apple', type: 'stock', market: 'US', quantity: 1, cost: 150, lastUpdated: 0, source: 'manual' });
        await testDb.assets.clear();
        const count = await testDb.assets.count();
        expect(count).toBe(0);
    });
});
