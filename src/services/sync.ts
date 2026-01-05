import { db } from "../db/database";
import { googleSheetsService } from "./googleSheets";

export const syncService = {
    async upload(accessToken: string) {
        try {
            const spreadsheetId = await googleSheetsService.findOrCreateSpreadsheet(accessToken);
            if (!spreadsheetId) throw new Error("Could not find or create spreadsheet");

            let localAssets = await db.assets.toArray();

            // Patch missing recordIds for legacy data
            for (const asset of localAssets) {
                if (!asset.recordId && asset.id) {
                    const newId = `${Date.now()}-${asset.symbol}-${Math.random().toString(36).substr(2, 9)}`;
                    await db.assets.update(asset.id, { recordId: newId });
                    asset.recordId = newId;
                }
            }

            // Overwrite cloud with local data
            await googleSheetsService.clearSheet(accessToken, spreadsheetId);
            await googleSheetsService.updatePortfolio(accessToken, spreadsheetId, localAssets);

            await db.syncLogs.add({
                lastSyncTime: Date.now(),
                status: 'success',
                message: `Uploaded ${localAssets.length} assets to cloud`
            });

            return { success: true, count: localAssets.length };
        } catch (error: any) {
            console.error("Upload failed:", error);
            return { success: false, error: error.message };
        }
    },

    async download(accessToken: string) {
        try {
            const spreadsheetId = await googleSheetsService.findOrCreateSpreadsheet(accessToken);
            if (!spreadsheetId) throw new Error("Cloud database not found");

            const remoteRows = await googleSheetsService.fetchPortfolio(accessToken, spreadsheetId);

            if (remoteRows.length === 0) throw new Error("No data found on cloud");

            // Clear local database and replace with cloud data
            await db.assets.clear();

            const importedAssets = remoteRows.map((row: any) => ({
                recordId: row[0],
                symbol: row[1],
                name: row[2],
                type: row[3],
                market: row[4],
                quantity: parseFloat(row[5]) || 0,
                cost: parseFloat(row[6]) || 0,
                lastUpdated: parseInt(row[7]) || Date.now(),
            }));

            await db.assets.bulkAdd(importedAssets);

            await db.syncLogs.add({
                lastSyncTime: Date.now(),
                status: 'success',
                message: `Restored ${importedAssets.length} assets from cloud`
            });

            return { success: true, count: importedAssets.length };
        } catch (error: any) {
            console.error("Download failed:", error);
            return { success: false, error: error.message };
        }
    }
};
