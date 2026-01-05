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
        const response = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${SHEET_NAME}!A2:H1000`,
            {
                headers: { Authorization: `Bearer ${accessToken}` },
            }
        );

        if (response.status === 401) {
            throw new Error("UNAUTHORIZED");
        }

        const data = await response.json();
        return data.values || [];
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
        if (spreadsheetId) return spreadsheetId;

        // 2. Search Drive for existing "AssetsTracker_DB"
        try {
            const query = encodeURIComponent("name = 'AssetsTracker_DB' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false");
            const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,modifiedTime)`, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            const searchData = await searchRes.json();

            if (searchData.files && searchData.files.length > 0) {
                // Sort by modifiedTime (newest first) to find the active one
                const sortedFiles = searchData.files.sort((a: any, b: any) =>
                    new Date(b.modifiedTime).getTime() - new Date(a.modifiedTime).getTime()
                );

                spreadsheetId = sortedFiles[0].id;
                console.log("Found existing spreadsheet(s). Using most recent:", spreadsheetId);
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
