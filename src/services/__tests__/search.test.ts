import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchService } from '../search';

describe('searchService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        global.fetch = vi.fn();
    });

    it('should return empty results if query is empty', async () => {
        const results = await searchService.search('', 'TW');
        expect(results).toEqual([]);
    });

    it('should format TWSE results correctly', async () => {
        const mockResponse = {
            suggestions: ["2330 台積電", "2331 某股票"]
        };

        (global.fetch as any).mockResolvedValue({
            json: async () => mockResponse,
        });

        const results = await searchService.searchTW('2330');

        expect(results).toHaveLength(2);
        expect(results[0]).toEqual({
            symbol: '2330.TW',
            name: '台積電',
            market: 'TW',
            type: 'stock'
        });
    });

    it('should format TPEx results correctly', async () => {
        const mockResponse = {
            suggestions: [
                { data: ["3293 鈊象\t3293"], type: "上櫃公司" }
            ]
        };

        (global.fetch as any).mockResolvedValue({
            json: async () => mockResponse,
        });

        const results = await searchService.searchTPEx('3293');

        expect(results).toHaveLength(1);
        expect(results[0]).toEqual({
            symbol: '3293.TWO',
            name: '鈊象',
            market: 'TW',
            type: 'stock'
        });
    });

    it('should deduplicate results by symbol in main search', async () => {
        // Mock searchTW and searchTPEx results
        const twSpy = vi.spyOn(searchService, 'searchTW').mockResolvedValue([
            { symbol: '2330.TW', name: 'TSMC', market: 'TW', type: 'stock' }
        ]);
        const tpexSpy = vi.spyOn(searchService, 'searchTPEx').mockResolvedValue([]);
        const yahooSpy = vi.spyOn(searchService, 'searchYahoo').mockResolvedValue([
            { symbol: '2330.TW', name: 'TSMC Yahoo', market: 'TW', type: 'stock' }
        ]);

        const results = await searchService.search('2330', 'TW');

        expect(results).toHaveLength(1);
        expect(results[0].symbol).toBe('2330.TW');

        // Restore mocks
        twSpy.mockRestore();
        tpexSpy.mockRestore();
        yahooSpy.mockRestore();
    });

    it('should search US stocks via Yahoo', async () => {
        const mockYahooResp = {
            quotes: [
                { symbol: 'AAPL', shortname: 'Apple Inc.', quoteType: 'EQUITY' },
                { symbol: 'MSFT', shortname: 'Microsoft', quoteType: 'EQUITY' }
            ]
        };

        (global.fetch as any).mockResolvedValue({
            json: async () => mockYahooResp,
        });

        const results = await searchService.searchYahoo('AAPL');

        expect(results.length).toBeGreaterThan(0);
        expect(results[0].symbol).toBe('AAPL');
    });

    it('should search crypto currencies', async () => {
        const mockYahooResp = {
            quotes: [
                { symbol: 'BTC-USD', shortname: 'Bitcoin USD', quoteType: 'CRYPTOCURRENCY' }
            ]
        };

        (global.fetch as any).mockResolvedValue({
            json: async () => mockYahooResp,
        });

        const results = await searchService.searchYahoo('BTC');

        expect(results.length).toBeGreaterThan(0);
        expect(results[0].type).toBe('crypto');
    });

    it('should handle empty Yahoo response', async () => {
        (global.fetch as any).mockResolvedValue({
            json: async () => ({ quotes: [] }),
        });

        const results = await searchService.searchYahoo('INVALID');
        expect(results).toEqual([]);
    });

    it('should handle fetch errors gracefully', async () => {
        (global.fetch as any).mockRejectedValue(new Error('Network error'));

        const results = await searchService.searchYahoo('TEST');
        expect(results).toEqual([]);
    });
});
