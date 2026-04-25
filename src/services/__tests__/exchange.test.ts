import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exchangeService } from '../exchange';
import { db } from '../../db/database';

vi.mock('../../db/database', () => ({
    db: {
        assets: {
            where: vi.fn(),
            bulkAdd: vi.fn(),
        },
        exchangeConfigs: {
            update: vi.fn(),
        },
        transaction: vi.fn(),
    },
}));

describe('exchangeService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        globalThis.fetch = vi.fn() as any;
        // crypto is already available in jsdom or can be mocked
    });

    it('should parse Pionex balances correctly', async () => {
        const mockPionexResp = {
            result: true,
            data: {
                balances: [
                    { coin: 'BTC', free: '0.1', frozen: '0.05' },
                    { coin: 'ETH', free: '1.0', frozen: '0.0' },
                    { coin: 'USDT', free: '0.0', frozen: '0.0' } // Should be ignored
                ]
            }
        };

        (globalThis.fetch as any).mockResolvedValue({
            json: async () => mockPionexResp,
        });

        const results = await exchangeService.fetchPionex('key', 'secret');

        expect(results).toHaveLength(2);
        expect(results[0].symbol).toBe('BTC-USD');
        expect(results[0].quantity).toBeCloseTo(0.15);
        expect(results[1].symbol).toBe('ETH-USD');
        expect(results[1].quantity).toBeCloseTo(1.0);
    });

    it('should parse BitoPro balances correctly', async () => {
        const mockBitoResp = {
            data: [
                { currency: 'BTC', amount: '0.5' },
                { currency: 'TWD', amount: '1000' }
            ]
        };

        (globalThis.fetch as any).mockResolvedValue({
            json: async () => mockBitoResp,
        });

        const results = await exchangeService.fetchBitoPro('key', 'secret');

        expect(results).toHaveLength(2);
        expect(results.find(r => r.name === 'BTC')?.symbol).toBe('BTC-USD');
        expect(results.find(r => r.name === 'BTC')?.quantity).toBe(0.5);
        expect(results.find(r => r.name === 'TWD')?.symbol).toBe('TWD');
        expect(results.find(r => r.name === 'TWD')?.market).toBe('TW');
    });

    it('should handle empty Pionex balances', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            json: async () => ({ result: true, data: { balances: [] } }),
        });

        const results = await exchangeService.fetchPionex('key', 'secret');
        expect(results).toEqual([]);
    });

    it('should handle fetchPionex API errors', async () => {
        (globalThis.fetch as any).mockRejectedValue(new Error('Network error'));

        await expect(exchangeService.fetchPionex('key', 'secret'))
            .rejects.toThrow();
    });

    it('should handle fetchBitoPro API errors', async () => {
        (globalThis.fetch as any).mockRejectedValue(new Error('Network error'));

        await expect(exchangeService.fetchBitoPro('key', 'secret'))
            .rejects.toThrow();
    });

    it('should filter out zero balances from Pionex', async () => {
        const mockResp = {
            result: true,
            data: {
                balances: [
                    { coin: 'BTC', free: '1.0', frozen: '0.0' },
                    { coin: 'ETH', free: '0.0', frozen: '0.0' }
                ]
            }
        };

        (globalThis.fetch as any).mockResolvedValue({
            json: async () => mockResp,
        });

        const results = await exchangeService.fetchPionex('key', 'secret');
        expect(results).toHaveLength(1);
        expect(results[0].symbol).toBe('BTC-USD');
    });
});

describe('exchangeService.syncBalances — purchaseDateMap preservation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        globalThis.fetch = vi.fn() as any;

        vi.mocked(db.transaction).mockImplementation((_mode: any, ..._rest: any[]) => {
            const cb = _rest[_rest.length - 1];
            return Promise.resolve().then(() => cb()) as any;
        });
        vi.mocked(db.assets.bulkAdd).mockResolvedValue(undefined as any);
        vi.mocked(db.exchangeConfigs.update).mockResolvedValue(undefined as any);
    });

    it('restores purchaseDate and cost from existing pionex asset into synced balances', async () => {
        const existingTs = 1700000000000;
        const existingAsset = {
            id: 1, recordId: 'pionex-btc', symbol: 'BTC-USD', name: 'BTC',
            type: 'crypto', market: 'Crypto', quantity: 0.3, cost: 45000,
            lastUpdated: Date.now(), source: 'pionex', purchaseDate: existingTs,
        };

        const mockToArray = vi.fn()
            .mockResolvedValueOnce([existingAsset])
            .mockResolvedValueOnce([]);

        vi.mocked(db.assets.where).mockReturnValue({
            equals: vi.fn().mockReturnValue({ toArray: mockToArray, delete: vi.fn().mockResolvedValue(0) }),
        } as any);

        (globalThis.fetch as any).mockResolvedValue({
            json: async () => ({ result: true, data: { balances: [{ coin: 'BTC', free: '0.5', frozen: '0.0' }] } }),
        });

        const config = { id: 1, exchangeName: 'pionex' as const, apiKey: 'k', apiSecret: 's', lastSynced: 0 };
        const result = await exchangeService.syncBalances(config);

        expect(result.success).toBe(true);
        expect(vi.mocked(db.assets.bulkAdd)).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.objectContaining({ symbol: 'BTC-USD', purchaseDate: existingTs, cost: 45000 }),
            ])
        );
    });

    it('leaves purchaseDate undefined when no prior record exists for symbol', async () => {
        vi.mocked(db.assets.where).mockReturnValue({
            equals: vi.fn().mockReturnValue({
                toArray: vi.fn().mockResolvedValue([]),
                delete: vi.fn().mockResolvedValue(0),
            }),
        } as any);

        (globalThis.fetch as any).mockResolvedValue({
            json: async () => ({ result: true, data: { balances: [{ coin: 'ETH', free: '1.0', frozen: '0.0' }] } }),
        });

        const config = { id: 1, exchangeName: 'pionex' as const, apiKey: 'k', apiSecret: 's', lastSynced: 0 };
        await exchangeService.syncBalances(config);

        const addedAssets = vi.mocked(db.assets.bulkAdd).mock.calls[0][0] as any[];
        expect(addedAssets[0].purchaseDate).toBeUndefined();
    });
});
