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

            // 3. Merging Logic: Use symbol as the unique key
            // Push local to remote (current simple version: remote replaces local if conflicts, or vice-versa)
            await googleSheetsService.updatePortfolio(accessToken, spreadsheetId, localAssets);

            if (remoteRows.length > 0) {
                for (const row of remoteRows) {
                    const remoteAsset = {
                        symbol: row[0],
                        name: row[1],
                        type: row[2],
                        market: row[3],
                        quantity: parseFloat(row[4]) || 0,
                        cost: parseFloat(row[5]) || 0,
                        lastUpdated: parseInt(row[6]) || Date.now(),
                    };

                    const existing = localAssets.find(a => a.symbol === remoteAsset.symbol);
                    if (existing && existing.id) {
                        // Update local if remote is newer (optional, for now we just put)
                        await db.assets.update(existing.id, remoteAsset);
                    } else {
                        // Add new
                        await db.assets.add(remoteAsset);
                    }
                }
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
