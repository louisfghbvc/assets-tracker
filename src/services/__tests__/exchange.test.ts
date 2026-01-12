import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exchangeService } from '../exchange';

describe('exchangeService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        global.fetch = vi.fn();
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

        (global.fetch as any).mockResolvedValue({
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

        (global.fetch as any).mockResolvedValue({
            json: async () => mockBitoResp,
        });

        const results = await exchangeService.fetchBitoPro('key', 'secret');

        expect(results).toHaveLength(2);
        expect(results.find(r => r.name === 'BTC')?.symbol).toBe('BTC-USD');
        expect(results.find(r => r.name === 'BTC')?.quantity).toBe(0.5);
        expect(results.find(r => r.name === 'TWD')?.symbol).toBe('TWD');
        expect(results.find(r => r.name === 'TWD')?.market).toBe('TW');
    });
});
