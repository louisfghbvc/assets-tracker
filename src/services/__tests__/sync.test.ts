import { describe, it, expect } from 'vitest';
import { syncService } from '../sync';

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
