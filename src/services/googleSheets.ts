const SHEET_NAME = 'Portfolio';

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
        try {
            // First, check if SHEET_NAME exists, otherwise fallback to first sheet
            const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets(properties(title))`, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            const metaData = await metaRes.json();
            const sheetExists = metaData.sheets?.some((s: any) => s.properties.title === SHEET_NAME);
            const targetSheet = sheetExists ? SHEET_NAME : metaData.sheets?.[0]?.properties.title || SHEET_NAME;

            const response = await fetch(
                `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${targetSheet}!A1:Z2000`,
                {
                    headers: { Authorization: `Bearer ${accessToken}` },
                }
            );

            if (response.status === 401) {
                throw new Error("UNAUTHORIZED");
            }

            const data = await response.json();
            console.log(`[Sync] Fetched ${data.values?.length || 0} rows from sheet: "${targetSheet}" in Spreadsheet: https://docs.google.com/spreadsheets/d/${spreadsheetId}`);
            return data.values || [];
        } catch (e) {
            console.error("Fetch portfolio failed:", e);
            throw e;
        }
    },

    async updatePortfolio(accessToken: string, spreadsheetId: string, assets: any[]) {
        const values = assets.map(asset => [
            asset.recordId,
            asset.symbol,
            asset.name,
            asset.type,
            asset.market,
            asset.quantity,
            asset.cost,
            asset.lastUpdated
        ]);

        // Add headers if updating the whole sheet
        const body = {
            values: [
                ['RecordId', 'Symbol', 'Name', 'Type', 'Market', 'Quantity', 'Cost', 'LastUpdated'],
                ...values
            ]
        };

        const response = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${SHEET_NAME}!A1:H${assets.length + 1}?valueInputOption=USER_ENTERED`,
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

    async clearSheet(accessToken: string, spreadsheetId: string) {
        const response = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${SHEET_NAME}!A1:Z1000:clear`,
            {
                method: 'POST',
                headers: { Authorization: `Bearer ${accessToken}` },
            }
        );

        if (response.status === 401) {
            throw new Error("UNAUTHORIZED");
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
            const query = encodeURIComponent("name = 'AssetsTracker_DB' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false");
            const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,modifiedTime)`, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            const searchData = await searchRes.json();

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
            }
        } catch (e) {
            console.error("Failed to search Drive:", e);
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
