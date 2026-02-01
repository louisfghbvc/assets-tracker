import { describe, it, expect } from 'vitest';
import { syncService } from '../sync';

describe('syncService', () => {
    describe('parsePortfolioRows', () => {
        it('should correctly map columns from headers', () => {
            const rows = [
                ['Symbol', 'Name', 'Qty', 'Cost'],
                ['2330.TW', 'TSMC', '1000', '600'],
                ['AAPL', 'Apple', '10', '150']
            ];

            const results = syncService.parsePortfolioRows(rows);

            expect(results).toHaveLength(2);
            expect(results[0].symbol).toBe('2330.TW');
            expect(results[0].quantity).toBe(1000);
            expect(results[1].symbol).toBe('AAPL');
            expect(results[1].quantity).toBe(10);
        });

        it('should handle "recordid" and "source" correctly', () => {
            const rows = [
                ['Symbol', 'Record ID', 'Source'],
                ['BTC-USD', 'uuid-123', 'exchange']
            ];

            const results = syncService.parsePortfolioRows(rows);

            expect(results[0].recordId).toBe('uuid-123');
            expect(results[0].source).toBe('exchange');
            expect(results[0].market).toBe('Crypto');
        });

        it('should normalize crypto symbols to SYMBOL-USD if hyphen missing', () => {
            const rows = [
                ['Symbol', 'Market'],
                ['BTC', 'Crypto']
            ];

            const results = syncService.parsePortfolioRows(rows);

            expect(results[0].symbol).toBe('BTC-USD');
        });

        it('should infer market correctly if missing', () => {
            const rows = [
                ['Symbol'],
                ['2330.TW'],
                ['AAPL'],
                ['BTC-USD']
            ];

            const results = syncService.parsePortfolioRows(rows);

            expect(results[0].market).toBe('TW');
            expect(results[1].market).toBe('US');
            expect(results[2].market).toBe('Crypto');
        });

        it('should skip rows with missing required fields', () => {
            const rows = [
                ['Symbol', 'Name'],
                ['', 'Invalid'],  // Missing symbol
                ['AAPL', '']      // Valid
            ];

            const results = syncService.parsePortfolioRows(rows);
            expect(results).toHaveLength(1);
            expect(results[0].symbol).toBe('AAPL');
        });
    });

    describe('parseExchangeRows', () => {
        it('should parse exchange configuration rows correctly', () => {
            const rows = [
                ['ExchangeName', 'ApiKey', 'ApiSecret', 'LastSynced'],
                ['pionex', 'key123', 'secret123', '1234567890']
            ];

            const results = syncService.parseExchangeRows(rows);

            expect(results).toHaveLength(1);
            expect(results[0]).toEqual({
                exchangeName: 'pionex',
                apiKey: 'key123',
                apiSecret: 'secret123',
                lastSynced: 1234567890
            });
        });

        it('should handle missing lastSynced field', () => {
            const rows = [
                ['ExchangeName', 'ApiKey', 'ApiSecret'],
                ['bitopro', 'key456', 'secret456']
            ];

            const results = syncService.parseExchangeRows(rows);

            expect(results).toHaveLength(1);
            expect(results[0].lastSynced).toBe(0);
        });
    });
});
