const SHEET_NAME = 'Portfolio';
const CONFIG_SHEET_NAME = 'ExchangeConfigs';

export interface GoogleSheetAsset {
    recordId: string;
    symbol: string;
    name: string;
    type: string;
    market: string;
    quantity: string;
    cost: string;
    lastUpdated: string;
}

export const googleSheetsService = {
    async fetchPortfolio(accessToken: string, spreadsheetId: string) {
        return this.fetchSheetValues(accessToken, spreadsheetId, SHEET_NAME);
    },

    async fetchExchanges(accessToken: string, spreadsheetId: string) {
        return this.fetchSheetValues(accessToken, spreadsheetId, CONFIG_SHEET_NAME);
    },

    async fetchSheetValues(accessToken: string, spreadsheetId: string, sheetName: string) {
        try {
            // Check if sheet exists
            const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets(properties(title))`, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            const metaData = await metaRes.json();
            const sheetExists = metaData.sheets?.some((s: any) => s.properties.title === sheetName);

            if (!sheetExists) return [];

            const response = await fetch(
                `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A1:Z2000`,
                {
                    headers: { Authorization: `Bearer ${accessToken}` },
                }
            );

            if (response.status === 401) {
                throw new Error("UNAUTHORIZED");
            }

            const data = await response.json();
            // console.log(`[Sync] Fetched ${data.values?.length || 0} rows from sheet: "${sheetName}" in Spreadsheet: https://docs.google.com/spreadsheets/d/${spreadsheetId}`); // Removed specific log
            return data.values || [];
        } catch (e) {
            console.error(`Fetch ${sheetName} failed:`, e);
            throw e;
        }
    },

    async updatePortfolio(accessToken: string, spreadsheetId: string, assets: any[]) {
        await this.ensureSheetExists(accessToken, spreadsheetId, SHEET_NAME);
        const values = assets.map(asset => [
            asset.recordId,
            asset.symbol,
            asset.name,
            asset.type,
            asset.market,
            asset.quantity,
            asset.cost,
            asset.lastUpdated,
            asset.source
        ]);

        const body = {
            values: [
                ['RecordId', 'Symbol', 'Name', 'Type', 'Market', 'Quantity', 'Cost', 'LastUpdated', 'Source'],
                ...values
            ]
        };

        return this.updateSheetValues(accessToken, spreadsheetId, SHEET_NAME, body, assets.length + 1, 'I');
    },

    async updateExchanges(accessToken: string, spreadsheetId: string, configs: any[]) {
        await this.ensureSheetExists(accessToken, spreadsheetId, CONFIG_SHEET_NAME);
        const values = configs.map(config => [
            config.exchangeName,
            config.apiKey,
            config.apiSecret,
            config.lastSynced || ''
        ]);

        const body = {
            values: [
                ['ExchangeName', 'ApiKey', 'ApiSecret', 'LastSynced'],
                ...values
            ]
        };

        return this.updateSheetValues(accessToken, spreadsheetId, CONFIG_SHEET_NAME, body, configs.length + 1, 'D');
    },

    async updateSheetValues(accessToken: string, spreadsheetId: string, sheetName: string, body: any, rowCount: number, lastCol: string) {
        const response = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A1:${lastCol}${rowCount}?valueInputOption=USER_ENTERED`,
            {
                method: 'PUT',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            }
        );

        if (response.status === 401) {
            throw new Error("UNAUTHORIZED");
        }

        return response.json();
    },

    async ensureSheetExists(accessToken: string, spreadsheetId: string, sheetName: string) {
        const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets(properties(title))`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        const metaData = await metaRes.json();
        const sheetExists = metaData.sheets?.some((s: any) => s.properties.title === sheetName);

        if (!sheetExists) {
            await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    requests: [{ addSheet: { properties: { title: sheetName } } }]
                })
            });
        }
    },

    async clearSheet(accessToken: string, spreadsheetId: string) {
        // Clear both sheets if they exist
        for (const name of [SHEET_NAME, CONFIG_SHEET_NAME]) {
            // Check if sheet exists before clearing
            const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets(properties(title))`, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            const metaData = await metaRes.json();
            const sheetExists = metaData.sheets?.some((s: any) => s.properties.title === name);

            if (sheetExists) {
                const response = await fetch(
                    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${name}!A1:Z2000:clear`,
                    {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${accessToken}` },
                    }
                );

                if (response.status === 401) {
                    throw new Error("UNAUTHORIZED");
                }
            }
        }
    },

    async findOrCreateSpreadsheet(accessToken: string) {
        // 1. Check local storage first
        let spreadsheetId = localStorage.getItem('google_spreadsheet_id');
        if (spreadsheetId) {
            try {
                // Verify the file exists and is not trashed
                const checkRes = await fetch(`https://www.googleapis.com/drive/v3/files/${spreadsheetId}?fields=id,trashed`, {
                    headers: { Authorization: `Bearer ${accessToken}` }
                });
                if (checkRes.ok) {
                    const checkData = await checkRes.json();
                    if (!checkData.trashed) {
                        console.log(`[Sync] Using valid spreadsheet from localStorage: https://docs.google.com/spreadsheets/d/${spreadsheetId}`);
                        return spreadsheetId;
                    } else {
                        console.warn("[Sync] Cached spreadsheet is in trash. Searching for a non-trashed one...");
                    }
                } else {
                    console.warn("[Sync] Cached spreadsheet ID is invalid or unreachable. Searching again...");
                }
            } catch (e) {
                console.error("[Sync] Failed to verify cached spreadsheet:", e);
            }
            // If we reach here, the cached ID is invalid or trashed
            localStorage.removeItem('google_spreadsheet_id');
            spreadsheetId = null;
        }

        // 2. Search Drive for existing "AssetsTracker_DB"
        try {
            // Chaneged from '=' to 'contains' to be more robust
            const query = encodeURIComponent("name contains 'AssetsTracker_DB' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false");
            const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,modifiedTime)`, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });

            if (!searchRes.ok) {
                const errText = await searchRes.text();
                console.error("[Sync] Drive search failed:", searchRes.status, errText);
                throw new Error("Drive API Error: Please ensure Google Drive API is enabled in your Google Cloud Console.");
            }

            const searchData = await searchRes.json();
            console.log("[Sync] Raw Drive search result:", searchData);

            if (searchData.files && searchData.files.length > 0) {
                console.log(`[Sync] Found ${searchData.files.length} matching spreadsheets:`, searchData.files.map((f: any) => `${f.name} (${f.id}) - Modified: ${f.modifiedTime}`));

                // Sort by modifiedTime (newest first) to find the active one
                const sortedFiles = searchData.files.sort((a: any, b: any) =>
                    new Date(b.modifiedTime).getTime() - new Date(a.modifiedTime).getTime()
                );

                spreadsheetId = sortedFiles[0].id;
                console.log("[Sync] Using the most recently modified spreadsheet:", spreadsheetId);
                localStorage.setItem('google_spreadsheet_id', spreadsheetId!);
                return spreadsheetId;
            } else {
                console.log("[Sync] No matching spreadsheets found with query:", decodeURIComponent(query));
            }
        } catch (e) {
            console.error("Failed to search Drive:", e);
            throw e; // Re-throw to propagate the error
        }

        // 3. Create new if not found
        const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                properties: { title: 'AssetsTracker_DB' },
                sheets: [{ properties: { title: SHEET_NAME } }]
            }),
        });

        if (response.status === 401) {
            throw new Error("UNAUTHORIZED");
        }

        const data = await response.json();
        spreadsheetId = data.spreadsheetId;
        if (spreadsheetId) {
            localStorage.setItem('google_spreadsheet_id', spreadsheetId);
        }
        return spreadsheetId;
    }
};
