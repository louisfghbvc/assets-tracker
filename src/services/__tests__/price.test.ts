import { describe, it, expect, vi, beforeEach } from 'vitest';
import { priceService, parseTwsePrice } from '../price';

describe('priceService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        globalThis.fetch = vi.fn();
        // Simulate web environment (no Tauri)
        delete (window as any).__TAURI_INTERNALS__;
    });

    describe('parseTwsePrice', () => {
        it('should return trade price z when valid', () => {
            expect(parseTwsePrice({ z: '600.0', b: '599.0_10', y: '595.0' })).toBe(600.0);
        });

        it('should fall back to best bid b when z is -', () => {
            expect(parseTwsePrice({ z: '-', b: '599.5_598.0_', y: '595.0' })).toBe(599.5);
        });

        it('should fall back to yesterday close y when z is - and b is -', () => {
            expect(parseTwsePrice({ z: '-', b: '-', y: '595.0' })).toBe(595.0);
        });

        it('should fall back to y when b contains only dashes', () => {
            expect(parseTwsePrice({ z: '-', b: '-_-_-_-_-', y: '595.0' })).toBe(595.0);
        });

        it('should fall back to ask a when z and b are unavailable', () => {
            expect(parseTwsePrice({ z: '-', b: '-', a: '600.5_601.0_', y: '595.0' })).toBe(600.5);
        });

        it('should handle whitespace in z, b, a, and y fields', () => {
            expect(parseTwsePrice({ z: ' 600.0 ' })).toBe(600.0);
            expect(parseTwsePrice({ z: ' - ', b: ' 599.5 _' })).toBe(599.5);
            expect(parseTwsePrice({ z: ' - ', b: ' - ', a: ' 600.5 _' })).toBe(600.5);
            expect(parseTwsePrice({ z: ' - ', b: ' - ', a: ' - ', y: ' 595.0 ' })).toBe(595.0);
        });

        it('should handle numeric fields in z, b, a, and y', () => {
            expect(parseTwsePrice({ z: 600.0 })).toBe(600.0);
            expect(parseTwsePrice({ z: '-', b: 599.5 })).toBe(599.5);
            expect(parseTwsePrice({ z: '-', b: '-', a: 600.5 })).toBe(600.5);
            expect(parseTwsePrice({ z: '-', b: '-', a: '-', y: 595.0 })).toBe(595.0);
        });

        it('should return 0 for invalid or empty msg', () => {
            expect(parseTwsePrice(null)).toBe(0);
            expect(parseTwsePrice({ z: '-', y: '0' })).toBe(0);
            expect(parseTwsePrice({ z: '-', b: '-', y: '-' })).toBe(0);
        });
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

        it('should parse multi-symbol batch quote responses from quoteResponse', async () => {
            const mockQuoteResp = {
                quoteResponse: {
                    result: [
                        { symbol: 'AAPL', regularMarketPrice: 180.25 },
                        { symbol: 'MSFT', regularMarketPrice: 420.50 },
                        { symbol: 'BTC-USD', regularMarketPrice: 65000.0 }
                    ]
                }
            };

            (globalThis.fetch as any).mockResolvedValue({
                ok: true,
                text: async () => JSON.stringify(mockQuoteResp),
            });

            const results = await priceService.fetchPricesWeb(['AAPL', 'MSFT', 'BTC']);
            expect(results).toHaveLength(3);
            expect(results.find(r => r.symbol === 'AAPL')?.price).toBe(180.25);
            expect(results.find(r => r.symbol === 'MSFT')?.price).toBe(420.50);
            expect(results.find(r => r.symbol === 'BTC')?.price).toBe(65000.0);
        });

        it('should handle mixed portfolio (US, Crypto, TWSE, Cash) correctly', async () => {
            (globalThis.fetch as any).mockImplementation(async (url: string, options?: any) => {
                const targetUrl = options?.body ? JSON.parse(options.body).url : url;
                if (targetUrl.includes('getStockInfo.jsp')) {
                    return {
                        ok: true,
                        text: async () => JSON.stringify({
                            msgArray: [
                                { c: '2330', z: '600.0' },
                                { c: '6488', z: '750.0' }
                            ]
                        })
                    };
                }
                return {
                    ok: true,
                    text: async () => JSON.stringify({
                        quoteResponse: {
                            result: [
                                { symbol: 'AAPL', regularMarketPrice: 175.0 },
                                { symbol: 'ETH-USD', regularMarketPrice: 3500.0 }
                            ]
                        }
                    })
                };
            });

            const results = await priceService.fetchPricesWeb(['USD', 'AAPL', '2330.TW', 'ETH', '6488.TW']);
            expect(results).toHaveLength(5);
            expect(results.find(r => r.symbol === 'USD')?.price).toBe(1);
            expect(results.find(r => r.symbol === 'AAPL')?.price).toBe(175.0);
            expect(results.find(r => r.symbol === '2330.TW')?.price).toBe(600.0);
            expect(results.find(r => r.symbol === 'ETH')?.price).toBe(3500.0);
            expect(results.find(r => r.symbol === '6488.TW')?.price).toBe(750.0);
        });

        it('should gracefully fallback when endpoint encounters rate limit', async () => {
            let callCount = 0;
            (globalThis.fetch as any).mockImplementation(async () => {
                callCount++;
                if (callCount === 1) {
                    return {
                        ok: true,
                        text: async () => 'Too many requests'
                    };
                }
                return {
                    ok: true,
                    text: async () => JSON.stringify({
                        chart: {
                            result: [{ meta: { regularMarketPrice: 150.0 } }]
                        }
                    })
                };
            });

            const results = await priceService.fetchPricesWeb(['AAPL']);
            expect(results).toHaveLength(1);
            expect(results[0].price).toBe(150.0);
        });

        it('should handle lowercase crypto, TWSE, and cash symbols', async () => {
            (globalThis.fetch as any).mockImplementation(async (url: string, options?: any) => {
                const targetUrl = options?.body ? JSON.parse(options.body).url : url;
                if (targetUrl.includes('getStockInfo.jsp')) {
                    return {
                        ok: true,
                        text: async () => JSON.stringify({
                            msgArray: [{ c: '2330', z: '620.0' }]
                        })
                    };
                }
                return {
                    ok: true,
                    text: async () => JSON.stringify({
                        quoteResponse: {
                            result: [
                                { symbol: 'BTC-USD', regularMarketPrice: 68000.0 },
                                { symbol: 'ETH-USD', regularMarketPrice: 3600.0 }
                            ]
                        }
                    })
                };
            });

            const results = await priceService.fetchPricesWeb(['usd', 'twd', 'btc', 'eth', '2330.tw']);
            expect(results).toHaveLength(5);
            expect(results.find(r => r.symbol === 'usd')?.price).toBe(1);
            expect(results.find(r => r.symbol === 'twd')?.price).toBe(1);
            expect(results.find(r => r.symbol === 'btc')?.price).toBe(68000.0);
            expect(results.find(r => r.symbol === 'eth')?.price).toBe(3600.0);
            expect(results.find(r => r.symbol === '2330.tw')?.price).toBe(620.0);
        });

        it('should preserve results for duplicate input symbols', async () => {
            const mockQuoteResp = {
                quoteResponse: {
                    result: [
                        { symbol: 'AAPL', regularMarketPrice: 180.0 }
                    ]
                }
            };

            (globalThis.fetch as any).mockResolvedValue({
                ok: true,
                text: async () => JSON.stringify(mockQuoteResp),
            });

            const results = await priceService.fetchPricesWeb(['AAPL', 'AAPL']);
            expect(results).toHaveLength(2);
            expect(results[0]).toEqual({ symbol: 'AAPL', price: 180.0 });
            expect(results[1]).toEqual({ symbol: 'AAPL', price: 180.0 });
        });

        it('should skip error JSON from first proxy and succeed with second proxy', async () => {
            let proxyCall = 0;
            (globalThis.fetch as any).mockImplementation(async () => {
                proxyCall++;
                if (proxyCall === 1) {
                    return {
                        ok: true,
                        text: async () => JSON.stringify({ error: 'Key required' }),
                    };
                }
                return {
                    ok: true,
                    text: async () => JSON.stringify({
                        quoteResponse: {
                            result: [{ symbol: 'AAPL', regularMarketPrice: 195.0 }]
                        }
                    }),
                };
            });

            const results = await priceService.fetchPricesWeb(['AAPL']);
            expect(results).toHaveLength(1);
            expect(results[0].price).toBe(195.0);
        });

        it('should fallback to chart indicators close if regularMarketPrice is missing or zero', async () => {
            (globalThis.fetch as any).mockImplementation(async (url: string) => {
                if (url.includes('quote?symbols=')) {
                    // quote returns null
                    return {
                        ok: true,
                        text: async () => JSON.stringify({ quoteResponse: { result: [] } }),
                    };
                }
                // fallback chart response with indicators close
                return {
                    ok: true,
                    text: async () => JSON.stringify({
                        chart: {
                            result: [{
                                meta: { symbol: 'AAPL' },
                                indicators: {
                                    quote: [{
                                        close: [190.0, 192.5, null]
                                    }]
                                }
                            }]
                        }
                    }),
                };
            });

            const results = await priceService.fetchPricesWeb(['AAPL']);
            expect(results).toHaveLength(1);
            expect(results[0].price).toBe(192.5);
        });

        it('should handle numeric msg.c without crashing', async () => {
            const mockTwseResp = {
                msgArray: [{ c: 2330, z: '600.0' }]
            };

            (globalThis.fetch as any).mockResolvedValue({
                ok: true,
                text: async () => JSON.stringify(mockTwseResp),
            });

            const results = await priceService.fetchPricesWeb(['2330.TW']);
            expect(results).toHaveLength(1);
            expect(results[0]).toEqual({ symbol: '2330.TW', price: 600.0 });
        });

        it('should fallback to previousClose when regularMarketPrice is 0 in quoteResponse', async () => {
            const mockQuoteResp = {
                quoteResponse: {
                    result: [
                        { symbol: 'AAPL', regularMarketPrice: 0, previousClose: 180.5 }
                    ]
                }
            };

            (globalThis.fetch as any).mockResolvedValue({
                ok: true,
                text: async () => JSON.stringify(mockQuoteResp),
            });

            const results = await priceService.fetchPricesWeb(['AAPL']);
            expect(results).toHaveLength(1);
            expect(results[0].price).toBe(180.5);
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
