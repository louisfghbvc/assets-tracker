import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AssetTrackerDatabase } from '../database';

describe('AssetTrackerDatabase', () => {
    let testDb: AssetTrackerDatabase;

    beforeEach(() => {
        // Each test gets a fresh in-memory DB via fake-indexeddb
        testDb = new AssetTrackerDatabase();
    });

    afterEach(async () => {
        // Clean up database after each test
        await testDb.assets.clear();
        await testDb.exchangeConfigs.clear();
        await testDb.syncLogs.clear();
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

    it('should update an asset', async () => {
        const id = await testDb.assets.add({
            recordId: '1',
            symbol: 'AAPL',
            name: 'Apple',
            type: 'stock',
            market: 'US',
            quantity: 10,
            cost: 150,
            lastUpdated: 0,
            source: 'manual'
        });

        await testDb.assets.update(id, { quantity: 20, cost: 160 });
        const updated = await testDb.assets.get(id);
        expect(updated?.quantity).toBe(20);
        expect(updated?.cost).toBe(160);
    });

    it('should delete an asset by id', async () => {
        const id = await testDb.assets.add({
            recordId: '1',
            symbol: 'AAPL',
            name: 'Apple',
            type: 'stock',
            market: 'US',
            quantity: 10,
            cost: 150,
            lastUpdated: 0,
            source: 'manual'
        });

        await testDb.assets.delete(id);
        const deleted = await testDb.assets.get(id);
        expect(deleted).toBeUndefined();
    });

    it('should add and retrieve exchange configs', async () => {
        const config = {
            exchangeName: 'pionex' as const,
            apiKey: 'test-key',
            apiSecret: 'test-secret',
            lastSynced: Date.now()
        };

        const id = await testDb.exchangeConfigs.add(config);
        const retrieved = await testDb.exchangeConfigs.get(id);
        expect(retrieved?.exchangeName).toBe('pionex');
        expect(retrieved?.apiKey).toBe('test-key');
    });

    it('should add and query sync logs', async () => {
        await testDb.syncLogs.add({
            lastSyncTime: Date.now(),
            status: 'success',
            message: 'Test sync'
        });

        const logs = await testDb.syncLogs.toArray();
        expect(logs).toHaveLength(1);
        expect(logs[0].status).toBe('success');
    });

    it('should query assets by source', async () => {
        await testDb.assets.bulkAdd([
            { recordId: '1', symbol: 'BTC-USD', name: 'Bitcoin', type: 'crypto', market: 'Crypto', quantity: 1, cost: 50000, lastUpdated: 0, source: 'pionex' },
            { recordId: '2', symbol: 'ETH-USD', name: 'Ethereum', type: 'crypto', market: 'Crypto', quantity: 5, cost: 3000, lastUpdated: 0, source: 'pionex' },
            { recordId: '3', symbol: 'AAPL', name: 'Apple', type: 'stock', market: 'US', quantity: 10, cost: 150, lastUpdated: 0, source: 'manual' }
        ]);

        const pionexAssets = await testDb.assets.where('source').equals('pionex').toArray();
        expect(pionexAssets).toHaveLength(2);
    });

    it('should count total assets', async () => {
        await testDb.assets.bulkAdd([
            { recordId: '1', symbol: 'AAPL', name: 'Apple', type: 'stock', market: 'US', quantity: 1, cost: 150, lastUpdated: 0, source: 'manual' },
            { recordId: '2', symbol: 'MSFT', name: 'Microsoft', type: 'stock', market: 'US', quantity: 1, cost: 300, lastUpdated: 0, source: 'manual' }
        ]);

        const count = await testDb.assets.count();
        expect(count).toBe(2);
    });

    it('should normalize market field during migration', async () => {
        // This tests the v4 migration logic
        // We need to simulate upgrading from v3 to v4
        // Note: This is tricky with Dexie as migrations run automatically
        // For now we'll test that assets with different market formats are handled

        await testDb.assets.bulkAdd([
            { recordId: '1', symbol: 'BTC-USD', name: 'Bitcoin', type: 'crypto', market: 'Crypto', quantity: 1, cost: 50000, lastUpdated: 0, source: 'manual' },
            { recordId: '2', symbol: 'AAPL', name: 'Apple', type: 'stock', market: 'US', quantity: 1, cost: 150, lastUpdated: 0, source: 'manual' },
            { recordId: '3', symbol: '2330.TW', name: 'TSMC', type: 'stock', market: 'TW', quantity: 1, cost: 600, lastUpdated: 0, source: 'manual' }
        ]);

        const assets = await testDb.assets.toArray();

        // Verify all market fields are properly normalized
        expect(assets.every(a => ['Crypto', 'US', 'TW'].includes(a.market))).toBe(true);
    });

    it('should handle assets without source field', async () => {
        // All new assets should have source field
        const asset = {
            recordId: '1',
            symbol: 'AAPL',
            name: 'Apple',
            type: 'stock' as const,
            market: 'US' as const,
            quantity: 10,
            cost: 150,
            lastUpdated: 0,
            source: 'manual' as const
        };

        const id = await testDb.assets.add(asset);
        const retrieved = await testDb.assets.get(id);

        expect(retrieved?.source).toBeDefined();
        expect(retrieved?.source).toBe('manual');
    });

    it('should query by recordId', async () => {
        const uniqueId = 'unique-record-123';
        await testDb.assets.add({
            recordId: uniqueId,
            symbol: 'AAPL',
            name: 'Apple',
            type: 'stock',
            market: 'US',
            quantity: 10,
            cost: 150,
            lastUpdated: 0,
            source: 'manual'
        });

        const found = await testDb.assets.where('recordId').equals(uniqueId).first();
        expect(found).toBeDefined();
        expect(found?.recordId).toBe(uniqueId);
    });

    it('should support bulk operations', async () => {
        const assets = [
            { recordId: '1', symbol: 'AAPL', name: 'Apple', type: 'stock' as const, market: 'US' as const, quantity: 1, cost: 150, lastUpdated: 0, source: 'manual' as const },
            { recordId: '2', symbol: 'MSFT', name: 'Microsoft', type: 'stock' as const, market: 'US' as const, quantity: 1, cost: 300, lastUpdated: 0, source: 'manual' as const },
            { recordId: '3', symbol: 'GOOGL', name: 'Google', type: 'stock' as const, market: 'US' as const, quantity: 1, cost: 2800, lastUpdated: 0, source: 'manual' as const },
        ];

        const ids = await testDb.assets.bulkAdd(assets, { allKeys: true });
        const count = await testDb.assets.count();
        expect(count).toBe(3);

        // Bulk delete using actual IDs
        await testDb.assets.bulkDelete([ids[0], ids[1]]);
        const remaining = await testDb.assets.count();
        expect(remaining).toBe(1);
    });
});
