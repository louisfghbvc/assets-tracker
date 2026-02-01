import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exchangeService } from '../exchange';

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
