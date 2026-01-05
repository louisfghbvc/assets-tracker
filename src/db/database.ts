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
}

export interface SyncLog {
    id?: number;
    lastSyncTime: number;
    status: 'success' | 'failed';
    message?: string;
}

export interface DeletedAsset {
    id?: number;
    recordId: string;
}

export class AssetTrackerDatabase extends Dexie {
    assets!: Table<Asset>;
    deletedAssets!: Table<DeletedAsset>;
    syncLogs!: Table<SyncLog>;

    constructor() {
        super('AssetTrackerDB');
        this.version(2).stores({
            assets: '++id, recordId, symbol, type, market, lastUpdated',
            deletedAssets: '++id, recordId',
            syncLogs: '++id, lastSyncTime'
        });
    }
}

export const db = new AssetTrackerDatabase();
