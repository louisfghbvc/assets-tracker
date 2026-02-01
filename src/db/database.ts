import Dexie, { type Table } from 'dexie';

export interface Asset {
    id?: number;
    recordId: string;         // Unique ID for sync
    symbol: string;           // e.g., 'AAPL', '2330.TW', 'BTC'
    name: string;
    type: 'stock' | 'crypto' | 'other';
    market: 'TW' | 'US' | 'Crypto';
    quantity: number;
    cost: number;             // Weighted average cost
    currentPrice?: number;
    lastUpdated: number;      // Timestamp
    source: 'manual' | 'pionex' | 'bitopro';
}

export interface ExchangeConfig {
    id?: number;
    exchangeName: 'pionex' | 'bitopro';
    apiKey: string;
    apiSecret: string;
    lastSynced?: number;
}

export interface SyncLog {
    id?: number;
    lastSyncTime: number;
    status: 'success' | 'failed';
    message?: string;
}

export interface HistoryRecord {
    id?: number;
    date: string; // YYYY-MM-DD
    totalValue: number;
    currency: string;
    note?: string;
}

export class AssetTrackerDatabase extends Dexie {
    assets!: Table<Asset>;
    syncLogs!: Table<SyncLog>;
    exchangeConfigs!: Table<ExchangeConfig>;
    history!: Table<HistoryRecord>;

    constructor() {
        super('AssetTrackerDB');
        this.version(3).stores({
            assets: '++id, recordId, symbol, type, market, lastUpdated, source',
            syncLogs: '++id, lastSyncTime',
            exchangeConfigs: '++id, exchangeName'
        });

        // Data Migration: Ensure existing assets have a 'source' and normalized market
        this.version(4).upgrade(async tx => {
            await tx.table('assets').toCollection().modify(asset => {
                if (!asset.source) asset.source = 'manual';
                const m = asset.market?.toUpperCase();
                if (m === 'CRYPTO') asset.market = 'Crypto';
                else if (m === 'TW') asset.market = 'TW';
                else if (m === 'US') asset.market = 'US';
            });
        });

        this.version(5).stores({
            history: '++id, date'
        });
    }
}

export const db = new AssetTrackerDatabase();
