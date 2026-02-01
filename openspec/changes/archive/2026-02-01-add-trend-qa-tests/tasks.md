# Tasks: Add Trend QA Tests

## 1. Test Setup & Infrastructure
- [x] Create `src/services/__tests__/history.test.ts` with mocks for Dexie.
- [x] Create `src/services/__tests__/sync.test.ts` for history parsing validation.

## 2. History Service Tests
- [x] Test `saveDailySnapshot` correctly updates existing records for the same day.
- [x] Test `saveDailySnapshot` creates new records for different days.
- [x] Test `updateNote` correctly updates the note field.

## 3. Sync Service Tests
- [x] Test `parseHistoryRows` correctly maps Date, TotalValue, Currency, and Note columns.
- [x] Test `parseHistoryRows` handles missing Note columns from legacy data.

## 4. Verification
- [x] Run tests using Vitest and ensure all pass.
