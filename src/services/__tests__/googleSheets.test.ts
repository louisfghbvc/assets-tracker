import { describe, it, expect, vi, beforeEach } from 'vitest';
import { googleSheetsService } from '../googleSheets';

describe('googleSheetsService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        globalThis.fetch = vi.fn();
        localStorage.clear();
    });

    it('should use spreadsheetId from localStorage if valid', async () => {
        const mockSpreadsheetId = 'local-id-123';
        const mockAccessToken = 'token-123';
        localStorage.setItem('google_spreadsheet_id', mockSpreadsheetId);

        (globalThis.fetch as any).mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ id: mockSpreadsheetId, trashed: false }),
        });

        const result = await googleSheetsService.findOrCreateSpreadsheet(mockAccessToken);

        expect(result).toBe(mockSpreadsheetId);
        expect(globalThis.fetch).toHaveBeenCalledWith(
            expect.stringContaining(`files/${mockSpreadsheetId}`),
            expect.objectContaining({
                headers: { Authorization: `Bearer ${mockAccessToken}` }
            })
        );
    });

    it('should search Drive if localStorage is empty', async () => {
        const mockSpreadsheetId = 'drive-id-456';
        const mockAccessToken = 'token-123';

        (globalThis.fetch as any).mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                files: [{ id: mockSpreadsheetId, name: 'AssetsTracker_DB', modifiedTime: '2023-01-01T00:00:00Z' }]
            }),
        });

        const result = await googleSheetsService.findOrCreateSpreadsheet(mockAccessToken);

        expect(result).toBe(mockSpreadsheetId);
        expect(localStorage.getItem('google_spreadsheet_id')).toBe(mockSpreadsheetId);
    });

    it('should throw UNAUTHORIZED when API returns 401', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            status: 401,
        });

        await expect(googleSheetsService.fetchPortfolio('token', 'id'))
            .rejects.toThrow('UNAUTHORIZED');
    });

    it('should return empty array when sheet does not exist', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ sheets: [] }),
        });

        const result = await googleSheetsService.fetchPortfolio('token', 'id');
        expect(result).toEqual([]);
    });

    it('should update portfolio with correct data format', async () => {
        const mockAssets = [
            { recordId: 'r1', symbol: 'AAPL', name: 'Apple', type: 'stock', market: 'US', quantity: 10, cost: 150, lastUpdated: 123456, source: 'manual' }
        ];

        (globalThis.fetch as any).mockImplementation((url: string) => {
            if (url.includes('batchUpdate')) {
                return Promise.resolve({ ok: true, json: async () => ({}) });
            }
            if (url.includes('values')) {
                return Promise.resolve({ ok: true, json: async () => ({}) });
            }
            return Promise.resolve({ ok: true, json: async () => ({ sheets: [{ properties: { title: 'Portfolio' } }] }) });
        });

        await googleSheetsService.updatePortfolio('token', 'id', mockAssets);

        expect(globalThis.fetch).toHaveBeenCalledWith(
            expect.stringContaining('values/Portfolio'),
            expect.objectContaining({
                method: 'PUT',
                headers: expect.objectContaining({
                    Authorization: 'Bearer token'
                }),
                body: expect.stringContaining('RecordId')
            })
        );
    });

    it('should update exchange configs correctly', async () => {
        const mockConfigs = [
            { exchangeName: 'pionex', apiKey: 'key1', apiSecret: 'secret1', lastSynced: 123456 }
        ];

        (globalThis.fetch as any).mockImplementation((url: string) => {
            if (url.includes('batchUpdate')) {
                return Promise.resolve({ ok: true, json: async () => ({}) });
            }
            if (url.includes('values')) {
                return Promise.resolve({ ok: true, json: async () => ({}) });
            }
            return Promise.resolve({ ok: true, json: async () => ({ sheets: [{ properties: { title: 'ExchangeConfigs' } }] }) });
        });

        await googleSheetsService.updateExchanges('token', 'id', mockConfigs);

        expect(globalThis.fetch).toHaveBeenCalledWith(
            expect.stringContaining('values/ExchangeConfigs'),
            expect.any(Object)
        );
    });

    it('should create new sheet if it does not exist', async () => {
        (globalThis.fetch as any).mockImplementation((url: string) => {
            if (url.includes('batchUpdate')) {
                return Promise.resolve({ ok: true, json: async () => ({}) });
            }
            return Promise.resolve({ ok: true, json: async () => ({ sheets: [] }) });
        });

        await googleSheetsService.ensureSheetExists('token', 'id', 'NewSheet');

        expect(globalThis.fetch).toHaveBeenCalledWith(
            expect.stringContaining('batchUpdate'),
            expect.objectContaining({
                method: 'POST',
                body: expect.stringContaining('addSheet')
            })
        );
    });

    it('should clear sheet data correctly', async () => {
        (globalThis.fetch as any).mockImplementation((url: string) => {
            if (url.includes('fields=sheets')) {
                return Promise.resolve({ ok: true, status: 200, json: async () => ({ sheets: [{ properties: { title: 'Portfolio' } }] }) });
            }
            return Promise.resolve({ ok: true, json: async () => ({}), status: 200 });
        });

        await googleSheetsService.clearSheet('token', 'id');

        // Check that the clear operation was called
        const putCall = (globalThis.fetch as any).mock.calls.find((call: any) =>
            call[1]?.method === 'POST' && call[0].includes(':clear')
        );
        expect(putCall).toBeDefined();
    });

    it('should include purchaseDate as 10th column with PurchaseDate header and DateReadable as 11th', async () => {
        const ts = 1700000000000;
        const mockAssets = [{
            recordId: 'r1', symbol: 'AAPL', name: 'Apple', type: 'stock', market: 'US',
            quantity: 10, cost: 150, lastUpdated: 123456, source: 'manual', purchaseDate: ts
        }];

        (globalThis.fetch as any).mockImplementation((url: string) => {
            if (url.includes('batchUpdate')) {
                return Promise.resolve({ ok: true, json: async () => ({}) });
            }
            if (url.includes('values')) {
                return Promise.resolve({ ok: true, json: async () => ({}) });
            }
            return Promise.resolve({ ok: true, json: async () => ({ sheets: [{ properties: { title: 'Portfolio' } }] }) });
        });

        await googleSheetsService.updatePortfolio('token', 'id', mockAssets);

        const valuesCall = (globalThis.fetch as any).mock.calls.find((call: any) =>
            call[0]?.includes('/values/Portfolio') && call[1]?.method === 'PUT'
        );
        expect(valuesCall).toBeDefined();
        const body = JSON.parse(valuesCall[1].body);
        expect(body.values[0][9]).toBe('PurchaseDate');
        expect(body.values[1][9]).toBe(ts);
        // K col header must be DateReadable (NOT PurchaseDateReadable — avoids parser collision)
        expect(body.values[0][10]).toBe('DateReadable');
        // K col value must be YYYY-MM-DD format string
        expect(body.values[1][10]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should serialize undefined purchaseDate as empty string, DateReadable also empty', async () => {
        const mockAssets = [{
            recordId: 'r1', symbol: 'AAPL', name: 'Apple', type: 'stock', market: 'US',
            quantity: 10, cost: 150, lastUpdated: 123456, source: 'manual'
        }];

        (globalThis.fetch as any).mockImplementation((url: string) => {
            if (url.includes('batchUpdate')) {
                return Promise.resolve({ ok: true, json: async () => ({}) });
            }
            if (url.includes('values')) {
                return Promise.resolve({ ok: true, json: async () => ({}) });
            }
            return Promise.resolve({ ok: true, json: async () => ({ sheets: [{ properties: { title: 'Portfolio' } }] }) });
        });

        await googleSheetsService.updatePortfolio('token', 'id', mockAssets);

        const valuesCall = (globalThis.fetch as any).mock.calls.find((call: any) =>
            call[0]?.includes('/values/Portfolio') && call[1]?.method === 'PUT'
        );
        const body = JSON.parse(valuesCall[1].body);
        expect(body.values[1][9]).toBe('');
        expect(body.values[1][10]).toBe('');
    });

    it('should use column J in portfolio sheet range', async () => {
        const mockAssets = [{
            recordId: 'r1', symbol: 'AAPL', name: 'Apple', type: 'stock', market: 'US',
            quantity: 10, cost: 150, lastUpdated: 123456, source: 'manual'
        }];

        (globalThis.fetch as any).mockImplementation((url: string) => {
            if (url.includes('batchUpdate')) {
                return Promise.resolve({ ok: true, json: async () => ({}) });
            }
            return Promise.resolve({ ok: true, json: async () => ({ sheets: [{ properties: { title: 'Portfolio' } }] }) });
        });

        await googleSheetsService.updatePortfolio('token', 'id', mockAssets);

        const valuesCall = (globalThis.fetch as any).mock.calls.find((call: any) =>
            call[0]?.includes('/values/Portfolio') && call[1]?.method === 'PUT'
        );
        expect(valuesCall[0]).toMatch(/K\d+/);
    });

    it('should include SellDateReadable and PurchaseDateSnapshotReadable cols in SellRecords', async () => {
        const ts = 1700000000000;
        const mockSellRecords = [{
            recordId: 'sr1', symbol: 'AAPL', name: 'Apple', market: 'US',
            soldQuantity: 5, avgCostAtSale: 150, sellPrice: 200,
            sellDate: ts, purchaseDateSnapshot: ts - 86400000 * 30,
            holdingDays: 30, exchangeRateAtSale: 32,
            realizedGain: 250, realizedGainTWD: 8000, fees: 10
        }];

        (globalThis.fetch as any).mockImplementation((url: string) => {
            if (url.includes('batchUpdate')) {
                return Promise.resolve({ ok: true, json: async () => ({}) });
            }
            if (url.includes('values')) {
                return Promise.resolve({ ok: true, json: async () => ({}) });
            }
            return Promise.resolve({ ok: true, json: async () => ({ sheets: [{ properties: { title: 'SellRecords' } }] }) });
        });

        await googleSheetsService.updateSellRecords('token', 'id', mockSellRecords);

        const valuesCall = (globalThis.fetch as any).mock.calls.find((call: any) =>
            call[0]?.includes('/values/SellRecords') && call[1]?.method === 'PUT'
        );
        expect(valuesCall).toBeDefined();
        const body = JSON.parse(valuesCall[1].body);
        expect(body.values[0][14]).toBe('SellDateReadable');
        expect(body.values[0][15]).toBe('PurchaseDateSnapshotReadable');
        expect(body.values[1][14]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(body.values[1][15]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(valuesCall[0]).toMatch(/P\d+/);
    });

    it('should create new spreadsheet when none found in Drive', async () => {
        (globalThis.fetch as any).mockImplementation((url: string, options: any) => {
            if (url.includes('files?q=')) {
                return Promise.resolve({ ok: true, status: 200, json: async () => ({ files: [] }) });
            }
            if (url.includes('create') || options?.method === 'POST') {
                return Promise.resolve({ ok: true, status: 200, json: async () => ({ spreadsheetId: 'new-id-789' }) });
            }
            return Promise.resolve({ ok: true, status: 200, json: async () => ({ sheets: [] }) });
        });

        const result = await googleSheetsService.findOrCreateSpreadsheet('token');

        expect(result).toBe('new-id-789');
        expect(localStorage.getItem('google_spreadsheet_id')).toBe('new-id-789');
    });
});
