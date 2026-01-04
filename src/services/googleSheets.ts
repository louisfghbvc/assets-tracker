const SHEET_NAME = 'Portfolio';

export interface GoogleSheetAsset {
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
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${SHEET_NAME}!A2:G100`,
            {
                headers: { Authorization: `Bearer ${accessToken}` },
            }
        );
        const data = await response.json();
        return data.values || [];
    },

    async updatePortfolio(accessToken: string, spreadsheetId: string, assets: any[]) {
        const values = assets.map(asset => [
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
                ['Symbol', 'Name', 'Type', 'Market', 'Quantity', 'Cost', 'LastUpdated'],
                ...values
            ]
        };

        const response = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${SHEET_NAME}!A1:G${assets.length + 1}?valueInputOption=USER_ENTERED`,
            {
                method: 'PUT',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            }
        );
        return response.json();
    },

    async findOrCreateSpreadsheet(accessToken: string) {
        // 1. Search for existing spreadsheet named "AssetsTracker"
        // (This would typically use the Drive API, but for simplicity we'll assume the user provides an ID or we create one)
        // For this implementation, let's create a new one if we don't have an ID

        // Check if we have a saved ID in local storage
        let spreadsheetId = localStorage.getItem('google_spreadsheet_id');
        if (spreadsheetId) return spreadsheetId;

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
        const data = await response.json();
        spreadsheetId = data.spreadsheetId;
        if (spreadsheetId) {
            localStorage.setItem('google_spreadsheet_id', spreadsheetId);
        }
        return spreadsheetId;
    }
};
