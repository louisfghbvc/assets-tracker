import { describe, it, expect } from 'vitest';
import { syncService } from '../sync';

describe('syncService parsePortfolioRows — purchaseDate', () => {
    it('detects purchaseDate column by "purchase" in header', () => {
        const rows = [
            ['RecordId', 'Symbol', 'Name', 'Type', 'Market', 'Quantity', 'Cost', 'LastUpdated', 'Source', 'PurchaseDate'],
            ['r1', 'AAPL', 'Apple', 'stock', 'US', '10', '150', '1700000000000', 'manual', '1700000000000'],
        ];
        // @ts-ignore
        const parsed = syncService.parsePortfolioRows(rows);
        expect(parsed).toHaveLength(1);
        expect(parsed[0].purchaseDate).toBe(1700000000000);
    });

    it('uses column 9 for purchaseDate in fallback colMap when no header row', () => {
        // No row matching 'symbol'/'ticker'/'代碼', so headerIndex stays -1 and fallback colMap is used
        const rows = [
            ['r1', 'AAPL', 'Apple', 'stock', 'US', '10', '150', '1700000000000', 'manual', '1700000000000'],
        ];
        // @ts-ignore
        const parsed = syncService.parsePortfolioRows(rows);
        expect(parsed).toHaveLength(1);
        expect(parsed[0].purchaseDate).toBe(1700000000000);
    });

    it('returns undefined for purchaseDate when column value is empty string', () => {
        const rows = [
            ['RecordId', 'Symbol', 'Name', 'Type', 'Market', 'Quantity', 'Cost', 'LastUpdated', 'Source', 'PurchaseDate'],
            ['r1', 'AAPL', 'Apple', 'stock', 'US', '10', '150', '1700000000000', 'manual', ''],
        ];
        // @ts-ignore
        const parsed = syncService.parsePortfolioRows(rows);
        expect(parsed[0].purchaseDate).toBeUndefined();
    });

    it('returns undefined for purchaseDate when value is not a number', () => {
        const rows = [
            ['RecordId', 'Symbol', 'Name', 'Type', 'Market', 'Quantity', 'Cost', 'LastUpdated', 'Source', 'PurchaseDate'],
            ['r1', 'AAPL', 'Apple', 'stock', 'US', '10', '150', '1700000000000', 'manual', 'not-a-number'],
        ];
        // @ts-ignore
        const parsed = syncService.parsePortfolioRows(rows);
        expect(parsed[0].purchaseDate).toBeUndefined();
    });

    it('preserves epoch-0 purchaseDate instead of converting to undefined', () => {
        const rows = [
            ['RecordId', 'Symbol', 'Name', 'Type', 'Market', 'Quantity', 'Cost', 'LastUpdated', 'Source', 'PurchaseDate'],
            ['r1', 'AAPL', 'Apple', 'stock', 'US', '10', '150', '1700000000000', 'manual', '0'],
        ];
        // @ts-ignore
        const parsed = syncService.parsePortfolioRows(rows);
        expect(parsed[0].purchaseDate).toBe(0);
    });

    it('returns undefined when purchaseDate column is absent from header', () => {
        const rows = [
            ['RecordId', 'Symbol', 'Name', 'Type', 'Market', 'Quantity', 'Cost', 'LastUpdated', 'Source'],
            ['r1', 'AAPL', 'Apple', 'stock', 'US', '10', '150', '1700000000000', 'manual'],
        ];
        // @ts-ignore
        const parsed = syncService.parsePortfolioRows(rows);
        expect(parsed[0].purchaseDate).toBeUndefined();
    });

    it('CRITICAL: DateReadable header in K col does NOT overwrite purchaseDate colMap', () => {
        // If K col header were named 'PurchaseDateReadable', sync.ts includes('purchase') would map
        // colMap.purchaseDate to K (index 10), causing parseInt('2024-01-15') = 2024 to silently
        // corrupt all purchaseDates on restore. 'DateReadable' must NOT trigger this.
        const rows = [
            ['RecordId', 'Symbol', 'Name', 'Type', 'Market', 'Quantity', 'Cost', 'LastUpdated', 'Source', 'PurchaseDate', 'DateReadable'],
            ['r1', 'AAPL', 'Apple', 'stock', 'US', '10', '150', '1700000000000', 'manual', '1700000000000', '2023-11-14'],
        ];
        // @ts-ignore
        const parsed = syncService.parsePortfolioRows(rows);
        expect(parsed[0].purchaseDate).toBe(1700000000000); // Must be Unix ms from J col, not 2023 from K col
    });
});

describe('syncService history parsing', () => {
    it('should parse history rows with notes correctly', () => {
        const rows = [
            ['Date', 'TotalValue', 'Currency', 'Note'],
            ['2024-01-01', '100000', 'TWD', 'New Year Fund'],
            ['2024-01-02', '105000', 'TWD', 'Profit from BTC'],
        ];

        // @ts-ignore - access private method for testing
        const parsed = syncService.parseHistoryRows(rows);

        expect(parsed.length).toBe(2);
        expect(parsed[0]).toEqual({
            date: '2024-01-01',
            totalValue: 100000,
            currency: 'TWD',
            note: 'New Year Fund'
        });
        expect(parsed[1].note).toBe('Profit from BTC');
    });

    it('should handle legacy history rows without note column', () => {
        const rows = [
            ['Date', 'TotalValue', 'Currency'],
            ['2024-01-01', '100000', 'TWD'],
        ];

        // @ts-ignore
        const parsed = syncService.parseHistoryRows(rows);

        expect(parsed.length).toBe(1);
        expect(parsed[0].date).toBe('2024-01-01');
        expect(parsed[0].note).toBeUndefined();
    });

    it('should handle rows with different column orders', () => {
        const rows = [
            ['Note', 'Currency', 'TotalValue', 'Date'],
            ['Buy Stock', 'TWD', '200000', '2024-02-01'],
        ];

        // @ts-ignore
        const parsed = syncService.parseHistoryRows(rows);

        expect(parsed.length).toBe(1);
        expect(parsed[0]).toEqual({
            date: '2024-02-01',
            totalValue: 200000,
            currency: 'TWD',
            note: 'Buy Stock'
        });
    });

    it('should normalize numeric values with commas', () => {
        const rows = [
            ['Date', 'TotalValue', 'Currency'],
            ['2024-01-01', '1,000,000', 'TWD'],
        ];

        // @ts-ignore
        const parsed = syncService.parseHistoryRows(rows);

        expect(parsed[0].totalValue).toBe(1000000);
    });
});
