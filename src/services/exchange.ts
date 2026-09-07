import { db, type ExchangeConfig, type Asset } from '../db/database';

// Fallback to free proxy when worker proxy URL is not set
const FALLBACK_PROXY = "https://api.codetabs.com/v1/proxy?quest=";
export const EXCHANGE_REQUEST_TIMEOUT_MS = 5000;

function normalizeHeaders(headers?: HeadersInit): Record<string, string> {
    if (!headers) return {};
    if (headers instanceof Headers) {
        const result: Record<string, string> = {};
        headers.forEach((value, key) => {
            result[key] = value;
        });
        return result;
    }
    if (Array.isArray(headers)) {
        return Object.fromEntries(headers);
    }
    return { ...headers };
}

function extractErrorMessage(data: any, fallback: string): string {
    if (!data) return fallback;
    if (typeof data === 'string' && data.trim()) return data.trim();
    if (Array.isArray(data) && data.length > 0) {
        return extractErrorMessage(data[0], fallback);
    }
    if (typeof data.message === 'string' && data.message.trim()) return data.message.trim();
    if (typeof data.msg === 'string' && data.msg.trim()) return data.msg.trim();
    if (typeof data.error_description === 'string' && data.error_description.trim()) return data.error_description.trim();
    if (typeof data.detail === 'string' && data.detail.trim()) return data.detail.trim();
    if (typeof data.description === 'string' && data.description.trim()) return data.description.trim();
    if (Array.isArray(data.errors) && data.errors.length > 0) {
        return extractErrorMessage(data.errors[0], fallback);
    }
    if (typeof data.error === 'string' && data.error.trim()) return data.error.trim();
    if (Array.isArray(data.error) && data.error.length > 0) {
        return extractErrorMessage(data.error[0], fallback);
    }
    if (typeof data.error === 'object' && data.error !== null) {
        if (typeof data.error.message === 'string' && data.error.message.trim()) {
            return data.error.message.trim();
        }
        if (typeof data.error.detail === 'string' && data.error.detail.trim()) {
            return data.error.detail.trim();
        }
        if (typeof data.error.error_description === 'string' && data.error.error_description.trim()) {
            return data.error.error_description.trim();
        }
        if (typeof data.error.description === 'string' && data.error.description.trim()) {
            return data.error.description.trim();
        }
        try {
            return JSON.stringify(data.error);
        } catch {
            // ignore
        }
    }
    if (typeof data.code === 'string' || typeof data.code === 'number') {
        return `Error code: ${data.code}`;
    }
    return fallback;
}

// Helper function to fetch via worker or fallback proxy
export async function fetchWithProxy(
    url: string,
    options: RequestInit = {},
    timeoutMs = EXCHANGE_REQUEST_TIMEOUT_MS
): Promise<Response> {
    const controller = new AbortController();
    let isTimeout = false;
    const timeout = setTimeout(() => {
        isTimeout = true;
        controller.abort();
    }, timeoutMs);

    const onCallerAbort = () => {
        if (!controller.signal.aborted) {
            controller.abort(options.signal?.reason);
        }
    };

    if (options.signal) {
        options.signal.addEventListener('abort', onCallerAbort, { once: true });
        if (options.signal.aborted) {
            controller.abort(options.signal.reason);
        }
    }

    try {
        const normalizedHeaders = normalizeHeaders(options.headers);
        const workerProxyUrl = import.meta.env.VITE_CORS_PROXY_URL;
        if (workerProxyUrl) {
            let response: Response;
            try {
                response = await fetch(workerProxyUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...Object.fromEntries(
                            Object.entries(normalizedHeaders).filter(([k]) =>
                                !['host', 'content-length'].includes(k.toLowerCase())
                            )
                        ),
                    },
                    body: JSON.stringify({
                        url,
                        method: options.method || 'GET',
                        headers: normalizedHeaders,
                    }),
                    signal: controller.signal,
                });
            } catch (error: any) {
                if (isTimeout) {
                    throw new Error('Exchange API request timed out');
                }
                if (options.signal?.aborted) {
                    throw error;
                }
                console.warn('⚠️ Worker proxy failed, using fallback for exchange API');
                return await fetchFallback(url, options, controller.signal);
            }

            const isError = response.ok === false || (typeof response.status === 'number' && response.status >= 400);

            if (!isError) {
                console.log('✓ Using worker proxy for exchange API');
                return response;
            }

            // Upstream exchange or worker returned an HTTP client/auth error or rate limit
            // Surface the error immediately instead of falling through to dead fallback proxy
            let errorMsg = `Exchange API error: HTTP ${response.status || 'unknown'}`;
            try {
                const text = await response.text();
                if (text) {
                    try {
                        const data = JSON.parse(text);
                        errorMsg = extractErrorMessage(data, errorMsg);
                    } catch {
                        const trimmed = text.trim();
                        const isHtml = trimmed.startsWith('<') || trimmed.toLowerCase().includes('<html') || trimmed.toLowerCase().includes('<!doctype');
                        if (trimmed.length > 0 && trimmed.length < 200 && !isHtml) {
                            errorMsg = trimmed;
                        }
                    }
                }
            } catch {
                // ignore
            }
            throw new Error(errorMsg);
        }

        // Fallback to free proxy if worker proxy URL is not configured
        return await fetchFallback(url, options, controller.signal);
    } catch (error: any) {
        if (isTimeout) {
            throw new Error('Exchange API request timed out');
        }
        if (options.signal?.aborted) {
            throw error;
        }
        throw error;
    } finally {
        clearTimeout(timeout);
        if (options.signal) {
            options.signal.removeEventListener('abort', onCallerAbort);
        }
    }
}

async function fetchFallback(url: string, options: RequestInit, signal: AbortSignal): Promise<Response> {
    const response = await fetch(`${FALLBACK_PROXY}${encodeURIComponent(url)}`, {
        ...options,
        signal,
    });

    const isError = response.ok === false || (typeof response.status === 'number' && response.status >= 400);
    if (isError) {
        let errorMsg = `Fallback proxy error: HTTP ${response.status || 'unknown'}`;
        try {
            const text = await response.text();
            if (text) {
                try {
                    const data = JSON.parse(text);
                    errorMsg = extractErrorMessage(data, errorMsg);
                } catch {
                    const trimmed = text.trim();
                    const isHtml = trimmed.startsWith('<') || trimmed.toLowerCase().includes('<html') || trimmed.toLowerCase().includes('<!doctype');
                    if (trimmed.length > 0 && trimmed.length < 200 && !isHtml) {
                        errorMsg = trimmed;
                    }
                }
            }
        } catch {
            // ignore
        }
        throw new Error(errorMsg);
    }

    return response;
}

async function hmacSha256(secret: string, message: string) {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw',
        enc.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', key, enc.encode(message));
    return Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

async function hmacSha384(secret: string, message: string) {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw',
        enc.encode(secret),
        { name: 'HMAC', hash: 'SHA-384' },
        false,
        ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', key, enc.encode(message));
    return Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

export const exchangeService = {
    async syncBalances(config: ExchangeConfig) {
        const { exchangeName, apiKey, apiSecret } = config;
        const normalizedSource = exchangeName.toLowerCase().trim();

        try {
            // 1. Fetch data from exchange FIRST (outside transaction to avoid blocking)
            let assetsToUpdate: Omit<Asset, 'id'>[] = [];
            if (normalizedSource === 'pionex') {
                assetsToUpdate = await this.fetchPionex(apiKey, apiSecret);
            } else if (normalizedSource === 'bitopro') {
                assetsToUpdate = await this.fetchBitoPro(apiKey, apiSecret);
            } else {
                throw new Error(`Unsupported exchange: ${exchangeName}`);
            }

            // 2. Perform DB update in a Transaction
            await db.transaction('rw', db.assets, db.exchangeConfigs, async () => {
                // Snapshot existing costs to persist them
                const existingAssets = await db.assets.where('source').equals(normalizedSource).toArray();
                // Also check for legacy case-sensitive sources during snapshot
                const legacySource = normalizedSource === 'bitopro' ? 'BitoPro' : (normalizedSource === 'pionex' ? 'Pionex' : null);
                if (legacySource) {
                    const legacyAssets = await db.assets.where('source').equals(legacySource).toArray();
                    existingAssets.push(...legacyAssets);
                }

                const costMap = new Map<string, number>();
                const purchaseDateMap = new Map<string, number | undefined>();
                const currentPriceMap = new Map<string, number | undefined>();

                for (const a of existingAssets) {
                    const upperSymbol = a.symbol.toUpperCase();
                    if (!costMap.has(upperSymbol) || (a.cost !== undefined && a.cost > 0)) {
                        costMap.set(upperSymbol, a.cost);
                    }
                    if (!purchaseDateMap.has(upperSymbol) || a.purchaseDate !== undefined) {
                        purchaseDateMap.set(upperSymbol, a.purchaseDate);
                    }
                    if (!currentPriceMap.has(upperSymbol) || (a.currentPrice !== undefined && a.currentPrice > 0)) {
                        currentPriceMap.set(upperSymbol, a.currentPrice);
                    }
                }

                // Restore existing costs, purchase dates, and current prices
                for (const asset of assetsToUpdate) {
                    const upperSymbol = asset.symbol.toUpperCase();
                    if (costMap.has(upperSymbol)) {
                        asset.cost = costMap.get(upperSymbol)!;
                    }
                    const savedDate = purchaseDateMap.get(upperSymbol);
                    if (savedDate !== undefined) {
                        asset.purchaseDate = savedDate;
                    }
                    const savedPrice = currentPriceMap.get(upperSymbol);
                    if (savedPrice !== undefined) {
                        asset.currentPrice = savedPrice;
                    }
                }

                // Delete OLD records (normalized and legacy)
                await db.assets.where('source').equals(normalizedSource).delete();
                if (legacySource) {
                    await db.assets.where('source').equals(legacySource).delete();
                }

                // Add NEW records
                if (assetsToUpdate.length > 0) {
                    await db.assets.bulkAdd(assetsToUpdate as Asset[]);
                }

                // Update last synced time
                if (config.id !== undefined) {
                    await db.exchangeConfigs.update(config.id, {
                        lastSynced: Date.now(),
                        exchangeName: normalizedSource as any,
                        lastError: undefined,
                    });
                }
            });

            return { success: true, count: assetsToUpdate.length };
        } catch (error: any) {
            const errorMsg = error.message || String(error);
            if (config.id !== undefined) {
                try {
                    await db.exchangeConfigs.update(config.id, {
                        lastError: errorMsg,
                    });
                } catch {
                    // ignore error updating config
                }
            }
            console.error(`Failed to sync ${exchangeName}: ${errorMsg}`);
            throw new Error(`Sync failed for ${exchangeName}: ${errorMsg}`);
        }
    },

    async fetchPionex(key: string, secret: string): Promise<Omit<Asset, 'id'>[]> {
        const timestamp = Date.now();
        const method = 'GET';
        const path = '/api/v1/account/balances';
        const query = `timestamp=${timestamp}`;
        const message = `${method}${path}?${query}`;
        const signature = await hmacSha256(secret, message);

        const url = `https://api.pionex.com${path}?${query}`;
        const res = await fetchWithProxy(url, {
            headers: {
                'PIONEX-KEY': key,
                'PIONEX-SIGNATURE': signature,
            }
        });

        const data = await res.json();
        if (data.result === false) {
            throw new Error(extractErrorMessage(data, 'Pionex API error'));
        }

        const balances = (data.data?.balances || []) as any[];
        const aggregated = new Map<string, number>();

        balances.forEach(b => {
            const amount = parseFloat(b.free) + parseFloat(b.frozen);
            if (amount > 0) {
                const coin = b.coin.toUpperCase();
                aggregated.set(coin, (aggregated.get(coin) || 0) + amount);
            }
        });

        return Array.from(aggregated.entries()).map(([coin, total]) => ({
            recordId: `pionex-${coin.toLowerCase()}`,
            symbol: coin.includes('-') ? coin : `${coin}-USD`,
            name: coin,
            type: 'crypto',
            market: 'Crypto',
            quantity: total,
            cost: 0,
            lastUpdated: Date.now(),
            source: 'pionex'
        }));
    },

    async fetchBitoPro(key: string, secret: string): Promise<Omit<Asset, 'id'>[]> {
        const nonce = Date.now();
        const payload = btoa(JSON.stringify({ nonce }));
        const signature = await hmacSha384(secret, payload);

        const url = 'https://api.bitopro.com/v3/accounts/balance';
        const res = await fetchWithProxy(url, {
            headers: {
                'X-BITOPRO-APIKEY': key,
                'X-BITOPRO-PAYLOAD': payload,
                'X-BITOPRO-SIGNATURE': signature,
            }
        });

        const data = await res.json();
        if (data.error) {
            throw new Error(extractErrorMessage(data, 'BitoPro API error'));
        }

        const balances = (data.data || []) as any[];
        const aggregated = new Map<string, number>();

        balances.forEach(b => {
            const amount = parseFloat(b.amount);
            if (amount > 0) {
                const currency = b.currency.toUpperCase();
                aggregated.set(currency, (aggregated.get(currency) || 0) + amount);
            }
        });

        return Array.from(aggregated.entries()).map(([currency, total]) => {
            const isTwd = currency === 'TWD';
            return {
                recordId: `bitopro-${currency.toLowerCase()}`,
                symbol: isTwd ? 'TWD' : (currency.includes('-') ? currency : `${currency}-USD`),
                name: currency,
                type: isTwd ? 'stock' : 'crypto',
                market: isTwd ? 'TW' : 'Crypto',
                quantity: total,
                cost: 0,
                lastUpdated: Date.now(),
                source: 'bitopro'
            };
        });
    },

    async deleteExchange(id: number, exchangeName: string) {
        await db.exchangeConfigs.delete(id);
        const normalized = exchangeName.toLowerCase().trim();
        await db.assets.where('source').equals(normalized).delete();
        const legacySource = normalized === 'bitopro' ? 'BitoPro' : (normalized === 'pionex' ? 'Pionex' : null);
        if (legacySource) {
            await db.assets.where('source').equals(legacySource).delete();
        }
        if (exchangeName !== normalized && exchangeName !== legacySource) {
            await db.assets.where('source').equals(exchangeName).delete();
        }
    }
};
