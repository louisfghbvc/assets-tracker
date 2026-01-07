import { db, type ExchangeConfig, type Asset } from '../db/database';

const CORS_PROXY = "https://corsproxy.io/?";

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

        try {
            // Snapshot existing costs to persist them
            const existingAssets = await db.assets.where('source').equals(exchangeName).toArray();
            const costMap = new Map<string, number>(existingAssets.map(a => [a.symbol, a.cost]));

            let assetsToUpdate: Omit<Asset, 'id'>[] = [];

            if (exchangeName === 'pionex') {
                assetsToUpdate = await this.fetchPionex(apiKey, apiSecret);
            } else if (exchangeName === 'bitopro') {
                assetsToUpdate = await this.fetchBitoPro(apiKey, apiSecret);
            }

            // Restore existing costs
            for (const asset of assetsToUpdate) {
                if (costMap.has(asset.symbol)) {
                    asset.cost = costMap.get(asset.symbol)!;
                }
            }

            // Update Database
            await db.assets.where('source').equals(exchangeName).delete();
            if (assetsToUpdate.length > 0) {
                await db.assets.bulkAdd(assetsToUpdate as Asset[]);
            }

            if (config.id) {
                await db.exchangeConfigs.update(config.id, { lastSynced: Date.now() });
            }

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

        const url = `${CORS_PROXY}${encodeURIComponent(`https://api.pionex.com${path}?${query}`)}`;
        const res = await fetch(url, {
            headers: {
                'PIONEX-KEY': key,
                'PIONEX-SIGNATURE': signature,
            }
        });

        const data = await res.json();
        if (data.result === false) throw new Error(data.message || 'Pionex API error');

        return (data.data?.balances || [])
            .filter((b: any) => parseFloat(b.free) + parseFloat(b.frozen) > 0)
            .map((b: any) => {
                const coin = b.coin.toUpperCase();
                return {
                    recordId: `pionex-${coin}-${Date.now()}`,
                    symbol: coin.includes('-') ? coin : `${coin}-USD`,
                    name: coin,
                    type: 'crypto',
                    market: 'Crypto',
                    quantity: parseFloat(b.free) + parseFloat(b.frozen),
                    cost: 0,
                    lastUpdated: Date.now(),
                    source: 'pionex'
                };
            });
    },

    async fetchBitoPro(key: string, secret: string): Promise<Omit<Asset, 'id'>[]> {
        const nonce = Date.now();
        const payload = btoa(JSON.stringify({ nonce }));
        const signature = await hmacSha384(secret, payload);

        const url = `${CORS_PROXY}${encodeURIComponent('https://api.bitopro.com/v3/accounts/balance')}`;
        const res = await fetch(url, {
            headers: {
                'X-BITOPRO-APIKEY': key,
                'X-BITOPRO-PAYLOAD': payload,
                'X-BITOPRO-SIGNATURE': signature,
            }
        });

        const data = await res.json();
        if (data.error) throw new Error(data.error || 'BitoPro API error');

        return (data.data || [])
            .filter((b: any) => parseFloat(b.amount) > 0)
            .map((b: any) => {
                const currency = b.currency.toUpperCase();
                const isTwd = currency === 'TWD';
                return {
                    recordId: `bitopro-${currency}-${Date.now()}`,
                    symbol: isTwd ? 'TWD' : (currency.includes('-') ? currency : `${currency}-USD`),
                    name: currency,
                    type: isTwd ? 'stock' : 'crypto',
                    market: isTwd ? 'TW' : 'Crypto',
                    quantity: parseFloat(b.amount),
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
