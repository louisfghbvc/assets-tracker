import { db } from "../db/database";
import { googleSheetsService } from "./googleSheets";

export const syncService = {
    async sync(accessToken: string) {
        try {
            const spreadsheetId = await googleSheetsService.findOrCreateSpreadsheet(accessToken);
            if (!spreadsheetId) throw new Error("Could not find or create spreadsheet");

            // 1. Fetch remote data
            const remoteRows = await googleSheetsService.fetchPortfolio(accessToken, spreadsheetId);

            // 2. Fetch local data
            const localAssets = await db.assets.toArray();

            // 3. Merging Logic
            // For simplicity in this version:
            // Local -> Remote: Push all local to remote
            // Remote -> Local: Pull all remote to local
            await googleSheetsService.updatePortfolio(accessToken, spreadsheetId, localAssets);

            if (remoteRows.length > 0) {
                const assetsFromRemote = remoteRows.map((row: any) => ({
                    symbol: row[0],
                    name: row[1],
                    type: row[2],
                    market: row[3],
                    quantity: parseFloat(row[4]),
                    cost: parseFloat(row[5]),
                    lastUpdated: parseInt(row[6]) || Date.now(),
                }));
                await db.assets.bulkPut(assetsFromRemote);
            }

            // 4. Update sync log
            await db.syncLogs.add({
                lastSyncTime: Date.now(),
                status: 'success',
                message: `Synced ${localAssets.length} assets`
            });

            return { success: true, count: localAssets.length };
        } catch (error: any) {
            console.error("Sync failed:", error);
            await db.syncLogs.add({
                lastSyncTime: Date.now(),
                status: 'failed',
                message: error.message
            });
            return { success: false, error: error.message };
        }
    }
};
