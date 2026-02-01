import { db, type HistoryRecord } from "../db/database";
import { googleSheetsService } from "./googleSheets";

export const syncService = {
    async upload(accessToken: string) {
        try {
            const spreadsheetId = await googleSheetsService.findOrCreateSpreadsheet(accessToken);
            if (!spreadsheetId) throw new Error("Could not find or create spreadsheet");

            const localAssets = await db.assets.toArray();
            const localExchanges = await db.exchangeConfigs.toArray();
            const localHistory = await db.history.toArray();

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
            await googleSheetsService.updateExchanges(accessToken, spreadsheetId, localExchanges);
            await googleSheetsService.updateHistory(accessToken, spreadsheetId, localHistory);

            await db.syncLogs.add({
                lastSyncTime: Date.now(),
                status: 'success',
                message: `Uploaded ${localAssets.length} assets and ${localExchanges.length} exchanges to cloud`
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

            // 1. Fetch Assets
            const allRows = await googleSheetsService.fetchPortfolio(accessToken, spreadsheetId);
            const portfolioAssets = this.parsePortfolioRows(allRows);

            // 2. Fetch Exchanges
            const exchangeRows = await googleSheetsService.fetchExchanges(accessToken, spreadsheetId);
            const importedExchanges = this.parseExchangeRows(exchangeRows);

            // 3. Fetch History
            const historyRows = await googleSheetsService.fetchHistory(accessToken, spreadsheetId);
            const importedHistory = this.parseHistoryRows(historyRows);

            // 4. Update local database
            await db.transaction('rw', db.assets, db.exchangeConfigs, db.syncLogs, db.history, async () => {
                await db.assets.clear();
                if (portfolioAssets.length > 0) await db.assets.bulkAdd(portfolioAssets);

                await db.exchangeConfigs.clear();
                if (importedExchanges.length > 0) await db.exchangeConfigs.bulkAdd(importedExchanges);

                // --- History Merge Logic ---
                const localHistory = await db.history.toArray();
                const mergedHistory: HistoryRecord[] = [...importedHistory];

                // Check local records for notes that might not be in the cloud
                for (const localRec of localHistory) {
                    const cloudMatchIdx = mergedHistory.findIndex(h => h.date === localRec.date);

                    if (cloudMatchIdx === -1) {
                        // Cloud doesn't have this date, but local does. Keep it!
                        mergedHistory.push(localRec);
                    } else if (localRec.note && localRec.note.trim() !== '' && !localRec.note.startsWith('Auto-')) {
                        // Both have the date, but LOCAL has a MANUAL note.
                        // We should prioritize the local note if the cloud note is auto or empty
                        const cloudRec = mergedHistory[cloudMatchIdx];
                        if (!cloudRec.note || cloudRec.note.trim() === '' || cloudRec.note.startsWith('Auto-')) {
                            mergedHistory[cloudMatchIdx] = {
                                ...cloudRec,
                                note: localRec.note
                            };
                        }
                    }
                }

                await db.history.clear();
                if (mergedHistory.length > 0) {
                    await db.history.bulkAdd(mergedHistory);
                }

                await db.syncLogs.add({
                    lastSyncTime: Date.now(),
                    status: 'success',
                    message: `Restored ${portfolioAssets.length} assets, ${importedExchanges.length} exchanges, and ${importedHistory.length} history records`
                });
            });

            return { success: true, count: portfolioAssets.length };
        } catch (error: any) {
            console.error("Download failed:", error);
            return { success: false, error: error.message };
        }
    },

    parsePortfolioRows(allRows: any[]) {
        if (allRows.length === 0) return [];

        let headerIndex = -1;
        let colMap: Record<string, number> = {};

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
                    if (cell.includes('source') || cell.includes('來源')) colMap.source = idx;
                });
                break;
            }
        }

        if (headerIndex === -1) {
            colMap = { recordId: 0, symbol: 1, name: 2, type: 3, market: 4, quantity: 5, cost: 6, lastUpdated: 7, source: 8 };
        }

        if (colMap.symbol === undefined) return [];

        const dataRows = allRows.slice(headerIndex + 1);
        return dataRows.map((rawRow: any) => {
            // Pre-process: Handle case where a row might be a single string containing tabs (pasted data)
            let row = rawRow;
            if (row.length === 1 && row[0]?.toString().includes('\t')) {
                row = row[0].toString().split('\t');
            }

            const symbol = row[colMap.symbol]?.toString().trim() || "";
            if (!symbol || symbol.toLowerCase() === 'symbol' || symbol.toLowerCase() === 'ticker') return null;

            const rawRecordId = colMap.recordId !== undefined ? row[colMap.recordId]?.toString().trim() : null;
            const recordId = (!rawRecordId || rawRecordId === "(留空)" || rawRecordId === "留空" || rawRecordId === "")
                ? `manual-${Date.now()}-${symbol}-${Math.random().toString(36).substr(2, 5)}`
                : rawRecordId;

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

            // Normalization: Ensure Crypto symbols are SYMBOL-USD format
            let normalizedSymbol = symbol;
            if (market?.toUpperCase() === "CRYPTO" && !normalizedSymbol.includes("-")) {
                normalizedSymbol = `${normalizedSymbol}-USD`;
            }

            return {
                recordId,
                symbol: normalizedSymbol,
                name: (colMap.name !== undefined ? row[colMap.name]?.toString().trim() : null) || symbol,
                type: type as 'stock' | 'crypto' | 'other',
                market: market as 'TW' | 'US' | 'Crypto',
                quantity: parseFloat(row[colMap.quantity]?.toString().replace(/,/g, '')) || 0,
                cost: parseFloat(row[colMap.cost]?.toString().replace(/,/g, '')) || 0,
                lastUpdated: parseInt(row[colMap.lastUpdated]) || Date.now(),
                source: (row[colMap.source]?.toString().trim() || 'manual') as any
            };
        }).filter((asset): asset is any => asset !== null);
    },

    parseExchangeRows(allRows: any[]) {
        if (allRows.length === 0) return [];

        let headerIndex = -1;
        let colMap: Record<string, number> = {};

        for (let i = 0; i < Math.min(allRows.length, 5); i++) {
            const row = allRows[i].map((c: any) => c.toString().toLowerCase().trim());
            if (row.includes('exchangename') || row.includes('apikey')) {
                headerIndex = i;
                row.forEach((cell: string, idx: number) => {
                    if (cell.includes('exchange')) colMap.exchangeName = idx;
                    if (cell.includes('key')) colMap.apiKey = idx;
                    if (cell.includes('secret')) colMap.apiSecret = idx;
                    if (cell.includes('synced')) colMap.lastSynced = idx;
                });
                break;
            }
        }

        if (headerIndex === -1) return [];

        const dataRows = allRows.slice(headerIndex + 1);
        return dataRows.map((row: any) => {
            if (!row[colMap.exchangeName] || !row[colMap.apiKey]) return null;
            return {
                exchangeName: row[colMap.exchangeName].toString().toLowerCase().trim() as any,
                apiKey: row[colMap.apiKey].toString().trim(),
                apiSecret: row[colMap.apiSecret]?.toString().trim() || '',
                lastSynced: parseInt(row[colMap.lastSynced]) || 0
            };
        }).filter(c => c !== null);
    },

    parseHistoryRows(allRows: any[]): HistoryRecord[] {
        if (allRows.length === 0) return [];

        let headerIndex = -1;
        let colMap: Record<string, number> = {};

        for (let i = 0; i < Math.min(allRows.length, 5); i++) {
            const row = allRows[i].map((c: any) => c.toString().toLowerCase().trim());
            if (row.includes('date')) {
                headerIndex = i;
                row.forEach((cell: string, idx: number) => {
                    if (cell.includes('date')) colMap.date = idx;
                    if (cell.includes('value')) colMap.totalValue = idx;
                    if (cell.includes('currency')) colMap.currency = idx;
                    if (cell.includes('note')) colMap.note = idx;
                });
                break;
            }
        }

        if (headerIndex === -1) return [];

        const dataRows = allRows.slice(headerIndex + 1);
        return dataRows.map((row: any): HistoryRecord | null => {
            if (!row[colMap.date] || !row[colMap.totalValue]) return null;
            return {
                date: row[colMap.date].toString().trim(),
                totalValue: parseFloat(row[colMap.totalValue].toString().replace(/,/g, '')) || 0,
                currency: row[colMap.currency]?.toString().trim() || 'TWD',
                note: colMap.note !== undefined ? row[colMap.note]?.toString().trim() : undefined
            };
        }).filter((h): h is HistoryRecord => h !== null);
    }
};
