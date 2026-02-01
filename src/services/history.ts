import { db, HistoryRecord } from '../db/database';

export const historyService = {
    /**
     * Saves a snapshot of the current total balance.
     * If a record for the current date (YYYY-MM-DD) already exists, it updates it.
     */
    async saveDailySnapshot(totalValue: number, currency: string = 'TWD'): Promise<void> {
        const today = new Date().toISOString().split('T')[0];

        const existingRec = await db.history.where('date').equals(today).first();

        if (existingRec && existingRec.id) {
            await db.history.update(existingRec.id, {
                totalValue,
                currency
            });
        } else {
            const newRecord: HistoryRecord = {
                date: today,
                totalValue,
                currency
            };
            await db.history.add(newRecord);
        }
    },

    /**
     * Retrieves all history records, sorted by date.
     */
    async getHistory(): Promise<HistoryRecord[]> {
        return await db.history.orderBy('date').toArray();
    },

    /**
     * Optional: Clear history
     */
    async clearHistory(): Promise<void> {
        await db.history.clear();
    },

    /**
     * Updates or adds a note for a specific record.
     */
    async updateNote(id: number, note: string): Promise<void> {
        await db.history.update(id, { note });
    }
};
