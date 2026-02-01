import { describe, it, expect, beforeEach } from 'vitest';
import { historyService } from '../history';
import { db } from '../../db/database';

describe('historyService', () => {
    beforeEach(async () => {
        await db.history.clear();
    });

    it('should save a daily snapshot and create a new record', async () => {
        await historyService.saveDailySnapshot(1000, 'TWD');
        const history = await db.history.toArray();

        expect(history.length).toBe(1);
        expect(history[0].totalValue).toBe(1000);
        expect(history[0].currency).toBe('TWD');
        expect(history[0].date).toBe(new Date().toISOString().split('T')[0]);
    });

    it('should update existing record if saved on the same day', async () => {
        await historyService.saveDailySnapshot(1000, 'TWD');
        await historyService.saveDailySnapshot(1500, 'TWD');

        const history = await db.history.toArray();
        expect(history.length).toBe(1);
        expect(history[0].totalValue).toBe(1500);
    });

    it('should update note for a specific record', async () => {
        await historyService.saveDailySnapshot(1000, 'TWD');
        const record = await db.history.toCollection().first();

        if (record && record.id) {
            await historyService.updateNote(record.id, 'Test Note');
            const updated = await db.history.get(record.id);
            expect(updated?.note).toBe('Test Note');
        } else {
            throw new Error('Record not found');
        }
    });

    it('should clear all history', async () => {
        await historyService.saveDailySnapshot(1000, 'TWD');
        await historyService.clearHistory();
        const history = await db.history.toArray();
        expect(history.length).toBe(0);
    });
});
