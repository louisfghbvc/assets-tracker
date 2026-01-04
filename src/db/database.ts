import Dexie, { type Table } from 'dexie';

export interface Asset {
    id?: number;
    symbol: string;           // e.g., 'AAPL', '2330.TW', 'BTC'
    name: string;
    type: 'stock' | 'crypto' | 'other';
    market: 'TW' | 'US' | 'Crypto';
    quantity: number;
    cost: number;             // Weighted average cost
    currentPrice?: number;
    lastUpdated: number;      // Timestamp
}

export interface SyncLog {
    id?: number;
    lastSyncTime: number;
    status: 'success' | 'failed';
    message?: string;
}

export class AssetTrackerDatabase extends Dexie {
    assets!: Table<Asset>;
    syncLogs!: Table<SyncLog>;

    constructor() {
        super('AssetTrackerDB');
        this.version(1).stores({
            assets: '++id, symbol, type, market, lastUpdated',
            syncLogs: '++id, lastSyncTime'
        });
    }
}

export const db = new AssetTrackerDatabase();
