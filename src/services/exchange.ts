import { db, type ExchangeConfig, type Asset } from '../db/database';

// Get worker proxy URL from environment, fallback to free proxy
const WORKER_PROXY_URL = import.meta.env.VITE_CORS_PROXY_URL;
const FALLBACK_PROXY = "https://api.codetabs.com/v1/proxy?quest=";

// Helper function to fetch via worker or fallback proxy
async function fetchWithProxy(url: string, options: RequestInit = {}): Promise<Response> {
    // Try worker first
    if (WORKER_PROXY_URL) {
        try {
            const response = await fetch(WORKER_PROXY_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...Object.fromEntries(
                        Object.entries(options.headers || {}).filter(([k]) =>
                            !['host', 'content-length'].includes(k.toLowerCase())
                        )
                    ),
                },
                body: JSON.stringify({
                    url,
                    method: options.method || 'GET',
                    headers: options.headers,
                }),
            });

            if (response.ok) {
                console.log('✓ Using worker proxy for exchange API');
                return response;
            }
        } catch (error) {
            console.warn('⚠️ Worker proxy failed, using fallback for exchange API');
        }
    }

    // Fallback to free proxy
    return fetch(`${FALLBACK_PROXY}${encodeURIComponent(url)}`, options);
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

                const costMap = new Map<string, number>(existingAssets.map(a => [a.symbol.toUpperCase(), a.cost]));

                // Restore existing costs
                for (const asset of assetsToUpdate) {
                    const upperSymbol = asset.symbol.toUpperCase();
                    if (costMap.has(upperSymbol)) {
                        asset.cost = costMap.get(upperSymbol)!;
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
                if (config.id) {
                    await db.exchangeConfigs.update(config.id, {
                        lastSynced: Date.now(),
                        exchangeName: normalizedSource as any
                    });
                }
            });

            return { success: true, count: assetsToUpdate.length };
        } catch (error: any) {
            console.error(`Failed to sync ${exchangeName}:`, error);
            throw new Error(`Sync failed for ${exchangeName}: ${error.message}`);
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
        if (data.result === false) throw new Error(data.message || 'Pionex API error');

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
        if (data.error) throw new Error(data.error || 'BitoPro API error');

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
        await db.assets.where('source').equals(exchangeName).delete();
    }
};
