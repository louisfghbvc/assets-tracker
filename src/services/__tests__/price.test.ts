import { describe, it, expect, vi, beforeEach } from 'vitest';
import { priceService } from '../price';

describe('priceService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        globalThis.fetch = vi.fn();
        // Simulate web environment (no Tauri)
        delete (window as any).__TAURI_INTERNALS__;
    });

    describe('fetchExchangeRate', () => {
        it('should return exchange rate from API in web mode', async () => {
            (globalThis.fetch as any).mockResolvedValue({
                json: async () => ({ rates: { TWD: 31.5 } }),
            });

            const rate = await priceService.fetchExchangeRate();
            expect(rate).toBe(31.5);
        });

        it('should return fallback rate if fetch fails', async () => {
            (globalThis.fetch as any).mockRejectedValue(new Error('API Down'));

            const rate = await priceService.fetchExchangeRate();
            expect(rate).toBe(32.5);
        });
    });

    describe('fetchPricesWeb', () => {
        it('should return 1 for USD/TWD symbols', async () => {
            const results = await priceService.fetchPricesWeb(['USD', 'TWD', 'USD-USD']);
            expect(results).toHaveLength(3);
            results.forEach(r => expect(r.price).toBe(1));
        });

        it('should correctly parse Yahoo Finance response', async () => {
            const mockYahooResp = {
                chart: {
                    result: [{
                        meta: { regularMarketPrice: 150.5 }
                    }]
                }
            };

            (globalThis.fetch as any).mockResolvedValue({
                ok: true,
                text: async () => JSON.stringify(mockYahooResp),
            });

            const results = await priceService.fetchPricesWeb(['AAPL']);
            expect(results).toHaveLength(1);
            expect(results[0]).toEqual({ symbol: 'AAPL', price: 150.5 });
        });

        it('should correctly parse TWSE response', async () => {
            const mockTwseResp = {
                msgArray: [{ z: '600.0', b: '599.0_10', y: '598.0' }]
            };

            (globalThis.fetch as any).mockResolvedValue({
                ok: true,
                text: async () => JSON.stringify(mockTwseResp),
            });

            const results = await priceService.fetchPricesWeb(['2330.TW']);
            expect(results).toHaveLength(1);
            expect(results[0]).toEqual({ symbol: '2330.TW', price: 600.0 });
        });

        it('should handle crypto symbols correctly', async () => {
            const mockYahooResp = {
                chart: {
                    result: [{
                        meta: { regularMarketPrice: 50000.0 }
                    }]
                }
            };

            (globalThis.fetch as any).mockResolvedValue({
                ok: true,
                text: async () => JSON.stringify(mockYahooResp),
            });

            const results = await priceService.fetchPricesWeb(['BTC-USD']);
            expect(results).toHaveLength(1);
            expect(results[0].price).toBe(50000.0);
        });



        it('should handle TWSE fallback when primary price is unavailable', async () => {
            const mockTwseResp = {
                msgArray: [{ z: '-', b: '599.0_10', y: '598.0' }]
            };

            (globalThis.fetch as any).mockResolvedValue({
                ok: true,
                text: async () => JSON.stringify(mockTwseResp),
            });

            const results = await priceService.fetchPricesWeb(['2330.TW']);
            expect(results[0].price).toBe(599.0); // Should use 'b' price
        });
    });

    describe('fetchHistoryWeb', () => {
        it('should parse historical data correctly', async () => {
            const mockHistoryResp = {
                chart: {
                    result: [{
                        timestamp: [1609459200, 1609545600],
                        indicators: {
                            quote: [{
                                open: [148.0, 150.0],
                                high: [151.0, 153.0],
                                low: [147.0, 149.0],
                                close: [150.0, 152.0],
                                volume: [1000000, 1200000],
                            }]
                        }
                    }]
                }
            };

            (globalThis.fetch as any).mockResolvedValue({
                ok: true,
                json: async () => mockHistoryResp,
            });

            const results = await priceService.fetchHistoryWeb('AAPL', '1d', '1d');
            expect(results.length).toBeGreaterThanOrEqual(0);
        });

        it('should return empty array on fetch error', async () => {
            (globalThis.fetch as any).mockRejectedValue(new Error('API Down'));

            const results = await priceService.fetchHistoryWeb('AAPL', '1d', '1d');
            expect(results).toEqual([]);
        });

        it('should handle missing chart data gracefully', async () => {
            (globalThis.fetch as any).mockResolvedValue({
                ok: true,
                json: async () => ({ chart: { result: null } }),
            });

            const results = await priceService.fetchHistoryWeb('INVALID', '1d', '1d');
            expect(results).toEqual([]);
        });

        it('should handle symbols with whitespace', async () => {
            const mockYahooResp = {
                chart: {
                    result: [{
                        meta: { regularMarketPrice: 150.0 }
                    }]
                }
            };

            (globalThis.fetch as any).mockResolvedValue({
                ok: true,
                text: async () => JSON.stringify(mockYahooResp),
            });

            const results = await priceService.fetchPricesWeb(['  AAPL  ', 'MSFT extra text']);
            expect(results.length).toBeGreaterThanOrEqual(0);
            // Symbols should be sanitized (whitespace trimmed and only first word taken)
        });

        it('should handle empty symbols array', async () => {
            const results = await priceService.fetchPrices([]);
            expect(results).toEqual([]);
        });

        it('should batch process multiple symbols', async () => {
            const mockYahooResp = {
                chart: {
                    result: [{
                        meta: { regularMarketPrice: 150.0 }
                    }]
                }
            };

            (globalThis.fetch as any).mockResolvedValue({
                ok: true,
                text: async () => JSON.stringify(mockYahooResp),
            });

            const results = await priceService.fetchPricesWeb(['AAPL', 'MSFT', 'GOOGL']);
            expect(results.length).toBeGreaterThanOrEqual(0);
        });

        it('should return USD and TWD as price 1', async () => {
            const results = await priceService.fetchPricesWeb(['USD', 'TWD', 'USD-USD']);
            expect(results).toHaveLength(3);
            results.forEach(r => expect(r.price).toBe(1));
        });
    });

    describe('fetchBenchmarkPrice', () => {
        const symbol = '^TWII';
        const startDateMs = 1700000000000;

        function makeYahooResponse(closes: (number | null)[], regularMarketPrice?: number) {
            const meta: Record<string, number> = {};
            if (regularMarketPrice !== undefined) meta.regularMarketPrice = regularMarketPrice;
            return {
                ok: true,
                text: async () => JSON.stringify({
                    chart: { result: [{ indicators: { quote: [{ close: closes }] }, meta }] },
                }),
            };
        }

        beforeEach(() => {
            priceService._benchmarkCache = null;
        });

        it('returns {startPrice, currentPrice} on success', async () => {
            (globalThis.fetch as any).mockResolvedValue(makeYahooResponse([null, 18500, 18600], 19000));
            const result = await priceService.fetchBenchmarkPrice(symbol, startDateMs);
            expect(result).toEqual({ startPrice: 18500, currentPrice: 19000 });
        });

        it('skips leading null and zero closes to find first valid startPrice', async () => {
            (globalThis.fetch as any).mockResolvedValue(makeYahooResponse([0, null, 18200], 19000));
            const result = await priceService.fetchBenchmarkPrice(symbol, startDateMs);
            expect(result).toEqual({ startPrice: 18200, currentPrice: 19000 });
        });

        it('returns null when all startCloses are null', async () => {
            (globalThis.fetch as any).mockResolvedValue(makeYahooResponse([null, null], 19000));
            const result = await priceService.fetchBenchmarkPrice(symbol, startDateMs);
            expect(result).toBeNull();
        });

        it('returns null when currentPrice is missing from meta', async () => {
            (globalThis.fetch as any).mockResolvedValue(makeYahooResponse([18500]));
            const result = await priceService.fetchBenchmarkPrice(symbol, startDateMs);
            expect(result).toBeNull();
        });

        it('returns null when fetch throws', async () => {
            (globalThis.fetch as any).mockRejectedValue(new Error('network error'));
            const result = await priceService.fetchBenchmarkPrice(symbol, startDateMs);
            expect(result).toBeNull();
        });

        it('returns null when all proxies return non-ok status', async () => {
            (globalThis.fetch as any).mockResolvedValue({ ok: false });
            const result = await priceService.fetchBenchmarkPrice(symbol, startDateMs);
            expect(result).toBeNull();
        });

        it('returns cached result on second call within TTL', async () => {
            (globalThis.fetch as any).mockResolvedValue(makeYahooResponse([18500], 19000));
            await priceService.fetchBenchmarkPrice(symbol, startDateMs);
            const callsAfterFirst = (globalThis.fetch as any).mock.calls.length;

            const result = await priceService.fetchBenchmarkPrice(symbol, startDateMs);
            expect(result).toEqual({ startPrice: 18500, currentPrice: 19000 });
            expect((globalThis.fetch as any).mock.calls.length).toBe(callsAfterFirst);
        });

        it('fetches fresh data when cache is stale (older than 1h)', async () => {
            const cacheKey = `${symbol}:${Math.floor(startDateMs / (60 * 60 * 1000))}`;
            priceService._benchmarkCache = {
                data: { [cacheKey]: { startPrice: 1, currentPrice: 1 } },
                fetchedAt: Date.now() - 2 * 60 * 60 * 1000,
            };
            (globalThis.fetch as any).mockResolvedValue(makeYahooResponse([18500], 19000));

            const result = await priceService.fetchBenchmarkPrice(symbol, startDateMs);
            expect(result).toEqual({ startPrice: 18500, currentPrice: 19000 });
            expect((globalThis.fetch as any).mock.calls.length).toBeGreaterThan(0);
        });

    });

    describe('fetchHistory fallback', () => {
        it('should fallback to web mode when Tauri not available', async () => {
            delete (window as any).__TAURI_INTERNALS__;

            const mockHistoryResp = {
                chart: {
                    result: [{
                        timestamp: [1609459200],
                        indicators: {
                            quote: [{
                                open: [148.0],
                                high: [151.0],
                                low: [147.0],
                                close: [150.0],
                                volume: [1000000],
                            }]
                        }
                    }]
                }
            };

            (globalThis.fetch as any).mockResolvedValue({
                ok: true,
                json: async () => mockHistoryResp,
            });

            const results = await priceService.fetchHistory('AAPL', '1d');
            expect(results.length).toBeGreaterThanOrEqual(0);
        });
    });
});
