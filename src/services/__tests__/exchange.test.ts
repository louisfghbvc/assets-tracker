import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exchangeService, fetchWithProxy, EXCHANGE_REQUEST_TIMEOUT_MS } from '../exchange';
import { db } from '../../db/database';

vi.mock('../../db/database', () => ({
    db: {
        assets: {
            where: vi.fn(),
            bulkAdd: vi.fn(),
        },
        exchangeConfigs: {
            update: vi.fn(),
            delete: vi.fn(),
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

    it('restores currentPrice from existing asset into synced balances', async () => {
        const existingAsset = {
            id: 1, recordId: 'pionex-btc', symbol: 'BTC-USD', name: 'BTC',
            type: 'crypto', market: 'Crypto', quantity: 0.3, cost: 45000,
            currentPrice: 88000, lastUpdated: Date.now(), source: 'pionex',
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
                expect.objectContaining({ symbol: 'BTC-USD', currentPrice: 88000, cost: 45000 }),
            ])
        );
    });
});

describe('fetchWithProxy — timeouts and fail-fast proxy handling', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.unstubAllEnvs();
        globalThis.fetch = vi.fn();
    });

    it('has a default timeout of 5000ms', () => {
        expect(EXCHANGE_REQUEST_TIMEOUT_MS).toBe(5000);
    });

    it('times out and throws clean error when request exceeds timeoutMs', async () => {
        vi.stubEnv('VITE_CORS_PROXY_URL', 'https://worker.test/proxy');
        (globalThis.fetch as any).mockImplementation((_url: string, opts: any) => {
            return new Promise((_, reject) => {
                if (opts?.signal) {
                    opts.signal.addEventListener('abort', () => {
                        reject(new DOMException('The operation was aborted', 'AbortError'));
                    });
                }
            });
        });

        await expect(fetchWithProxy('https://api.pionex.com/test', {}, 10))
            .rejects.toThrow('Exchange API request timed out');

        // Verify fallback proxy was not called after abort
        expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    it('fails fast on 401 auth error without falling through to public fallback proxy', async () => {
        vi.stubEnv('VITE_CORS_PROXY_URL', 'https://worker.test/proxy');
        const mock401 = new Response(JSON.stringify({ message: 'INVALID_API_KEY' }), {
            status: 401,
            statusText: 'Unauthorized',
            headers: { 'Content-Type': 'application/json' },
        });
        (globalThis.fetch as any).mockResolvedValue(mock401);

        await expect(fetchWithProxy('https://api.pionex.com/api/v1/account/balances'))
            .rejects.toThrow('INVALID_API_KEY');

        // Critical: Must only call worker proxy once, never call fallback proxy (api.codetabs.com)
        expect(globalThis.fetch).toHaveBeenCalledTimes(1);
        expect((globalThis.fetch as any).mock.calls[0][0]).toBe('https://worker.test/proxy');
    });

    it('fails fast on 403 Forbidden without calling fallback proxy', async () => {
        vi.stubEnv('VITE_CORS_PROXY_URL', 'https://worker.test/proxy');
        const mock403 = new Response(JSON.stringify({ error: 'IP address not allowed' }), {
            status: 403,
            statusText: 'Forbidden',
            headers: { 'Content-Type': 'application/json' },
        });
        (globalThis.fetch as any).mockResolvedValue(mock403);

        await expect(fetchWithProxy('https://api.pionex.com/test'))
            .rejects.toThrow('IP address not allowed');

        expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    it('fails fast on 429 Rate Limit without calling fallback proxy', async () => {
        vi.stubEnv('VITE_CORS_PROXY_URL', 'https://worker.test/proxy');
        const mock429 = new Response(JSON.stringify({ message: 'Too many requests' }), {
            status: 429,
            statusText: 'Too Many Requests',
            headers: { 'Content-Type': 'application/json' },
        });
        (globalThis.fetch as any).mockResolvedValue(mock429);

        await expect(fetchWithProxy('https://api.pionex.com/test'))
            .rejects.toThrow('Too many requests');

        expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    it('surfaces plain-text error messages from 400 responses', async () => {
        vi.stubEnv('VITE_CORS_PROXY_URL', 'https://worker.test/proxy');
        const mock400 = new Response('Bad Request: Invalid timestamp parameter', {
            status: 400,
            statusText: 'Bad Request',
        });
        (globalThis.fetch as any).mockResolvedValue(mock400);

        await expect(fetchWithProxy('https://api.pionex.com/test'))
            .rejects.toThrow('Bad Request: Invalid timestamp parameter');

        expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    it('falls back to public proxy with timeout signal when worker proxy is not configured', async () => {
        vi.stubEnv('VITE_CORS_PROXY_URL', '');
        const mockResponse = new Response(JSON.stringify({ ok: true }), { status: 200 });
        (globalThis.fetch as any).mockResolvedValue(mockResponse);

        const res = await fetchWithProxy('https://api.pionex.com/test');
        expect(res).toBe(mockResponse);
        expect(globalThis.fetch).toHaveBeenCalledTimes(1);
        expect((globalThis.fetch as any).mock.calls[0][0]).toContain('https://api.codetabs.com/v1/proxy?quest=');
    });

    it('enforces timeout on fallback proxy when worker proxy URL is unset', async () => {
        vi.stubEnv('VITE_CORS_PROXY_URL', '');
        (globalThis.fetch as any).mockImplementation((_url: string, opts: any) => {
            return new Promise((_, reject) => {
                if (opts?.signal) {
                    opts.signal.addEventListener('abort', () => {
                        reject(new DOMException('The operation was aborted', 'AbortError'));
                    });
                }
            });
        });

        await expect(fetchWithProxy('https://api.pionex.com/test', {}, 10))
            .rejects.toThrow('Exchange API request timed out');
    });

    it('surfaces error from fallback proxy when fallback proxy returns 4xx', async () => {
        vi.stubEnv('VITE_CORS_PROXY_URL', '');
        const mock403 = new Response(JSON.stringify({ error: 'Proxy forbidden' }), {
            status: 403,
            statusText: 'Forbidden',
            headers: { 'Content-Type': 'application/json' },
        });
        (globalThis.fetch as any).mockResolvedValue(mock403);

        await expect(fetchWithProxy('https://api.pionex.com/test'))
            .rejects.toThrow('Proxy forbidden');
    });

    it('extracts nested error object messages without producing [object Object]', async () => {
        vi.stubEnv('VITE_CORS_PROXY_URL', 'https://worker.test/proxy');
        const mockNestedError = new Response(JSON.stringify({
            error: { code: 504, message: 'Cloudflare worker timed out upstream' }
        }), {
            status: 504,
            statusText: 'Gateway Timeout',
            headers: { 'Content-Type': 'application/json' },
        });
        (globalThis.fetch as any).mockResolvedValue(mockNestedError);

        await expect(fetchWithProxy('https://api.pionex.com/test'))
            .rejects.toThrow('Cloudflare worker timed out upstream');
    });

    it('correctly normalizes Headers class instances in request options', async () => {
        vi.stubEnv('VITE_CORS_PROXY_URL', 'https://worker.test/proxy');
        const mockSuccess = new Response(JSON.stringify({ ok: true }), { status: 200 });
        (globalThis.fetch as any).mockResolvedValue(mockSuccess);

        const customHeaders = new Headers();
        customHeaders.set('PIONEX-KEY', 'my-api-key');
        customHeaders.set('PIONEX-SIGNATURE', 'my-sig');

        await fetchWithProxy('https://api.pionex.com/test', {
            headers: customHeaders,
        });

        expect(globalThis.fetch).toHaveBeenCalledTimes(1);
        const [fetchUrl, fetchOpts] = (globalThis.fetch as any).mock.calls[0];
        expect(fetchUrl).toBe('https://worker.test/proxy');
        expect(fetchOpts.headers['pionex-key']).toBe('my-api-key');
        expect(fetchOpts.headers['pionex-signature']).toBe('my-sig');

        const parsedBody = JSON.parse(fetchOpts.body);
        expect(parsedBody.headers['pionex-key']).toBe('my-api-key');
        expect(parsedBody.headers['pionex-signature']).toBe('my-sig');
    });

    it('propagates caller abort rather than masking it as timeout', async () => {
        vi.stubEnv('VITE_CORS_PROXY_URL', 'https://worker.test/proxy');
        const callerController = new AbortController();

        (globalThis.fetch as any).mockImplementation((_url: string, opts: any) => {
            return new Promise((_, reject) => {
                if (opts?.signal) {
                    opts.signal.addEventListener('abort', () => {
                        reject(new DOMException('Caller aborted', 'AbortError'));
                    });
                }
            });
        });

        const promise = fetchWithProxy('https://api.pionex.com/test', {
            signal: callerController.signal,
        }, 10000);

        // Abort from caller before timeout fires
        callerController.abort();

        await expect(promise).rejects.toThrow('Caller aborted');
    });

    it('surfaces error cleanly when proxy returns HTML error page without falling through or leaking raw HTML', async () => {
        vi.stubEnv('VITE_CORS_PROXY_URL', 'https://worker.test/proxy');
        const mock502Html = new Response('<!DOCTYPE html><html><body><h1>502 Bad Gateway</h1><p>Cloudflare worker error</p></body></html>', {
            status: 502,
            statusText: 'Bad Gateway',
            headers: { 'Content-Type': 'text/html' },
        });
        (globalThis.fetch as any).mockResolvedValue(mock502Html);

        await expect(fetchWithProxy('https://api.pionex.com/test'))
            .rejects.toThrow('Exchange API error: HTTP 502');

        // Verify fallback proxy was not called
        expect(globalThis.fetch).toHaveBeenCalledTimes(1);

        // Also test partial HTML markup like <title>502 Bad Gateway</title>
        const mock502Snippet = new Response('<title>502 Bad Gateway</title>', {
            status: 502,
            statusText: 'Bad Gateway',
            headers: { 'Content-Type': 'text/html' },
        });
        (globalThis.fetch as any).mockResolvedValueOnce(mock502Snippet);
        await expect(fetchWithProxy('https://api.pionex.com/test-snippet'))
            .rejects.toThrow('Exchange API error: HTTP 502');
    });

    it('surfaces error cleanly when proxy returns empty body without hanging', async () => {
        vi.stubEnv('VITE_CORS_PROXY_URL', 'https://worker.test/proxy');
        const mock500Empty = new Response('', {
            status: 500,
            statusText: 'Internal Server Error',
        });
        (globalThis.fetch as any).mockResolvedValue(mock500Empty);

        await expect(fetchWithProxy('https://api.pionex.com/test'))
            .rejects.toThrow('Exchange API error: HTTP 500');

        expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    it('extracts error from novel error payload shapes (detail, errors array, array payload, error_description)', async () => {
        vi.stubEnv('VITE_CORS_PROXY_URL', 'https://worker.test/proxy');

        // Test error_description field
        (globalThis.fetch as any).mockResolvedValueOnce(
            new Response(JSON.stringify({ error: 'invalid_grant', error_description: 'Client credentials expired' }), { status: 401 })
        );
        await expect(fetchWithProxy('https://api.pionex.com/test0'))
            .rejects.toThrow('Client credentials expired');

        // Test detail field
        (globalThis.fetch as any).mockResolvedValueOnce(
            new Response(JSON.stringify({ detail: 'Token signature invalid' }), { status: 401 })
        );
        await expect(fetchWithProxy('https://api.pionex.com/test1'))
            .rejects.toThrow('Token signature invalid');

        // Test errors array with message objects
        (globalThis.fetch as any).mockResolvedValueOnce(
            new Response(JSON.stringify({ errors: [{ message: 'Rate limit exceeded for endpoint' }] }), { status: 429 })
        );
        await expect(fetchWithProxy('https://api.pionex.com/test2'))
            .rejects.toThrow('Rate limit exceeded for endpoint');

        // Test errors array with strings
        (globalThis.fetch as any).mockResolvedValueOnce(
            new Response(JSON.stringify({ errors: ['Maintenance in progress'] }), { status: 503 })
        );
        await expect(fetchWithProxy('https://api.pionex.com/test3'))
            .rejects.toThrow('Maintenance in progress');

        // Test root array with error message
        (globalThis.fetch as any).mockResolvedValueOnce(
            new Response(JSON.stringify([{ message: 'IP address restricted' }]), { status: 403 })
        );
        await expect(fetchWithProxy('https://api.pionex.com/test4'))
            .rejects.toThrow('IP address restricted');
    });

    it('cleans up abort event listener from caller signal on completion', async () => {
        vi.stubEnv('VITE_CORS_PROXY_URL', 'https://worker.test/proxy');
        const mockSuccess = new Response(JSON.stringify({ ok: true }), { status: 200 });
        (globalThis.fetch as any).mockResolvedValue(mockSuccess);

        const callerController = new AbortController();
        const removeEventListenerSpy = vi.spyOn(callerController.signal, 'removeEventListener');

        await fetchWithProxy('https://api.pionex.com/test', {
            signal: callerController.signal,
        });

        expect(removeEventListenerSpy).toHaveBeenCalledWith('abort', expect.any(Function));
    });

    it('propagates custom caller abort reason when provided', async () => {
        vi.stubEnv('VITE_CORS_PROXY_URL', 'https://worker.test/proxy');
        const callerController = new AbortController();
        const customReason = new Error('Custom caller cancellation');

        (globalThis.fetch as any).mockImplementation((_url: string, opts: any) => {
            return new Promise((_, reject) => {
                if (opts?.signal) {
                    opts.signal.addEventListener('abort', () => {
                        reject(callerController.signal.reason || new DOMException('Aborted', 'AbortError'));
                    });
                }
            });
        });

        const promise = fetchWithProxy('https://api.pionex.com/test', {
            signal: callerController.signal,
        }, 10000);

        callerController.abort(customReason);

        await expect(promise).rejects.toThrow('Custom caller cancellation');
    });
});

describe('fetchPionex and fetchBitoPro 401 handling', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.unstubAllEnvs();
        vi.stubEnv('VITE_CORS_PROXY_URL', 'https://worker.test/proxy');
        globalThis.fetch = vi.fn();
    });

    it('fetchPionex throws immediately on 401 auth error', async () => {
        const mock401 = new Response(JSON.stringify({ result: false, message: 'INVALID_API_KEY' }), {
            status: 401,
            statusText: 'Unauthorized',
            headers: { 'Content-Type': 'application/json' },
        });
        (globalThis.fetch as any).mockResolvedValue(mock401);

        await expect(exchangeService.fetchPionex('bad-key', 'secret'))
            .rejects.toThrow('INVALID_API_KEY');

        // Fallback proxy must not have been called
        expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    it('fetchBitoPro throws immediately on 401 auth error', async () => {
        const mock401 = new Response(JSON.stringify({ error: 'Invalid API key or signature' }), {
            status: 401,
            statusText: 'Unauthorized',
            headers: { 'Content-Type': 'application/json' },
        });
        (globalThis.fetch as any).mockResolvedValue(mock401);

        await expect(exchangeService.fetchBitoPro('bad-key', 'secret'))
            .rejects.toThrow('Invalid API key or signature');

        // Fallback proxy must not have been called
        expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });
});

describe('Concurrent multi-exchange sync', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.unstubAllEnvs();
        globalThis.fetch = vi.fn();

        vi.mocked(db.transaction).mockImplementation((_mode: any, ..._rest: any[]) => {
            const cb = _rest[_rest.length - 1];
            return Promise.resolve().then(() => cb()) as any;
        });
        vi.mocked(db.assets.bulkAdd).mockResolvedValue(undefined as any);
        vi.mocked(db.exchangeConfigs.update).mockResolvedValue(undefined as any);
    });

    it('syncs multiple exchanges concurrently without blocking each other when one fails', async () => {
        vi.stubEnv('VITE_CORS_PROXY_URL', 'https://worker.test/proxy');

        vi.mocked(db.assets.where).mockReturnValue({
            equals: vi.fn().mockReturnValue({
                toArray: vi.fn().mockResolvedValue([]),
                delete: vi.fn().mockResolvedValue(0),
            }),
        } as any);

        // Pionex returns 401, BitoPro succeeds with balances
        (globalThis.fetch as any).mockImplementation(async (_url: string, opts: any) => {
            const body = JSON.parse(opts.body);
            if (body.url.includes('pionex.com')) {
                return new Response(JSON.stringify({ message: 'EXPIRED_KEY' }), {
                    status: 401,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
            if (body.url.includes('bitopro.com')) {
                return new Response(JSON.stringify({
                    data: [{ currency: 'BTC', amount: '0.2' }]
                }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
            throw new Error('Unknown URL');
        });

        const pionexConfig = { id: 1, exchangeName: 'pionex' as const, apiKey: 'pk', apiSecret: 'ps' };
        const bitoConfig = { id: 2, exchangeName: 'bitopro' as const, apiKey: 'bk', apiSecret: 'bs' };

        const results = await Promise.allSettled([
            exchangeService.syncBalances(pionexConfig),
            exchangeService.syncBalances(bitoConfig),
        ]);

        expect(results[0].status).toBe('rejected');
        if (results[0].status === 'rejected') {
            expect(results[0].reason.message).toContain('EXPIRED_KEY');
        }

        expect(results[1].status).toBe('fulfilled');
        if (results[1].status === 'fulfilled') {
            expect(results[1].value.success).toBe(true);
            expect(results[1].value.count).toBe(1);
        }

        // BitoPro assets were added despite Pionex 401 failure
        expect(vi.mocked(db.assets.bulkAdd)).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.objectContaining({ symbol: 'BTC-USD', quantity: 0.2 }),
            ])
        );

        // Pionex config was updated with lastError
        expect(vi.mocked(db.exchangeConfigs.update)).toHaveBeenCalledWith(
            1,
            expect.objectContaining({
                lastError: expect.stringContaining('EXPIRED_KEY'),
            })
        );

        // BitoPro config was updated with lastSynced and cleared lastError
        expect(vi.mocked(db.exchangeConfigs.update)).toHaveBeenCalledWith(
            2,
            expect.objectContaining({
                lastSynced: expect.any(Number),
                lastError: undefined,
            })
        );
    });

    it('rejects unsupported exchange names without deleting assets or proceeding', async () => {
        const unsupportedConfig = { id: 99, exchangeName: 'binance' as any, apiKey: 'k', apiSecret: 's' };

        await expect(exchangeService.syncBalances(unsupportedConfig))
            .rejects.toThrow('Unsupported exchange: binance');

        expect(vi.mocked(db.assets.bulkAdd)).not.toHaveBeenCalled();
    });

    it('deleteExchange removes exchange config and cleans up both normalized and legacy assets', async () => {
        const mockDelete = vi.fn().mockResolvedValue(1);
        vi.mocked(db.assets.where).mockReturnValue({
            equals: vi.fn().mockReturnValue({ delete: mockDelete }),
        } as any);
        vi.mocked(db.exchangeConfigs.delete).mockResolvedValue(undefined as any);

        await exchangeService.deleteExchange(1, 'bitopro');

        expect(vi.mocked(db.exchangeConfigs.delete)).toHaveBeenCalledWith(1);
        expect(vi.mocked(db.assets.where)).toHaveBeenCalledWith('source');
        expect(mockDelete).toHaveBeenCalledTimes(2); // bitopro and legacy BitoPro
    });
});
