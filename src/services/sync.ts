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

            // 3. Simple Push-First Strategy (for MVP)
            // In a real app, we'd compare lastUpdated timestamps
            await googleSheetsService.updatePortfolio(accessToken, spreadsheetId, localAssets);

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
