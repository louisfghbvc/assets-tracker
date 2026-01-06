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

            const allRows = await googleSheetsService.fetchPortfolio(accessToken, spreadsheetId);
            if (allRows.length === 0) throw new Error("No data found on cloud");

            // 1. Identify Header Row & Map Columns
            let headerIndex = -1;
            let colMap: Record<string, number> = {};

            // Search first 5 rows for headers
            for (let i = 0; i < Math.min(allRows.length, 5); i++) {
                const row = allRows[i].map((c: any) => c.toString().toLowerCase().trim());
                if (row.includes('symbol') || row.includes('ticker') || row.includes('代碼')) {
                    headerIndex = i;
                    row.forEach((cell: string, idx: number) => {
                        if (cell.includes('symbol') || cell.includes('ticker') || cell.includes('代碼')) colMap.symbol = idx;
                        if (cell.includes('record') || cell.includes('id') || cell.includes('唯一標識')) colMap.recordId = idx;
                        if (cell.includes('name') || cell.includes('名稱')) colMap.name = idx;
                        if (cell.includes('type') || cell.includes('類型')) colMap.type = idx;
                        if (cell.includes('market') || cell.includes('市場')) colMap.market = idx;
                        if (cell.includes('quantity') || cell.includes('qty') || cell.includes('數量')) colMap.quantity = idx;
                        if (cell.includes('cost') || cell.includes('成本')) colMap.cost = idx;
                        if (cell.includes('updated') || cell.includes('time') || cell.includes('更新時間')) colMap.lastUpdated = idx;
                    });
                    break;
                }
            }

            // Fallback for headerless sheet or if detection fails
            if (headerIndex === -1) {
                console.warn("No header row detected. Using default legacy column mapping.");
                colMap = { recordId: 0, symbol: 1, name: 2, type: 3, market: 4, quantity: 5, cost: 6, lastUpdated: 7 };
            }

            if (colMap.symbol === undefined) {
                throw new Error("Could not find 'Symbol' column in Google Sheet. Please ensure you have a header named 'Symbol'.");
            }

            const dataRows = allRows.slice(headerIndex + 1);
            if (dataRows.length === 0) throw new Error("No data rows found below headers");

            // 2. Process Data Rows with Inference
            const importedAssets = dataRows
                .map((rawRow: any) => {
                    // Pre-process: Handle case where a row might be a single string containing tabs (pasted data)
                    let row = rawRow;
                    if (row.length === 1 && row[0]?.toString().includes('\t')) {
                        row = row[0].toString().split('\t');
                    }

                    const symbol = row[colMap.symbol]?.toString().trim() || "";
                    if (!symbol || symbol.toLowerCase() === 'symbol' || symbol.toLowerCase() === 'ticker') return null;

                    const rawRecordId = colMap.recordId !== undefined ? row[colMap.recordId]?.toString().trim() : null;
                    const isManualId = !rawRecordId || rawRecordId === "(留空)" || rawRecordId === "留空" || rawRecordId === "";
                    const recordId = isManualId ? `manual-${Date.now()}-${symbol}-${Math.random().toString(36).substr(2, 5)}` : rawRecordId;

                    // Infer Market
                    let market = colMap.market !== undefined ? row[colMap.market]?.toString().toUpperCase().trim() : null;
                    if (!market || !['TW', 'US', 'CRYPTO'].includes(market)) {
                        const s = symbol.toUpperCase();
                        if (symbol.endsWith(".TW") || symbol.endsWith(".TWO")) market = "TW";
                        else if (['BTC', 'ETH', 'SOL', 'USDT', 'BNB', 'XRP', 'ADA', 'DOGE'].some(c => s.includes(c))) market = "Crypto";
                        else market = "US";
                    }

                    // Infer Type
                    let type = colMap.type !== undefined ? row[colMap.type]?.toString().toLowerCase().trim() : null;
                    if (!type || !['stock', 'crypto', 'other'].includes(type)) {
                        type = (market === "Crypto") ? "crypto" : "stock";
                    }

                    return {
                        recordId,
                        symbol,
                        name: (colMap.name !== undefined ? row[colMap.name]?.toString().trim() : null) || symbol,
                        type: type as 'stock' | 'crypto' | 'other',
                        market: market as 'TW' | 'US' | 'Crypto',
                        quantity: parseFloat(row[colMap.quantity]?.toString().replace(/,/g, '')) || 0,
                        cost: parseFloat(row[colMap.cost]?.toString().replace(/,/g, '')) || 0,
                        lastUpdated: parseInt(row[colMap.lastUpdated]) || Date.now(),
                    } as any;
                })
                .filter((asset: any) => asset !== null);

            console.log(`Successfully parsed ${importedAssets.length} valid assets from cloud data.`);
            if (importedAssets.length === 0) throw new Error("No valid assets found in the sheet to import.");

            // 3. Clear local database and replace with cloud data
            await db.assets.clear();
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
