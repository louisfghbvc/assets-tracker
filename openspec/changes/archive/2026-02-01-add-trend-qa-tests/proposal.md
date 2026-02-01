# Proposal: Add QA Tests for Trend Features

## Why
The recent implementation of asset trend enhancements (profit %, time ranges, and notes) introduces complex calculation and synchronization logic. Adding unit tests ensures data accuracy and prevents future regressions.

## What Changes
- Add unit tests for `historyService` (saving snapshots, updating notes).
- Add unit tests for `syncService` (parsing history with notes).
- Add unit tests for trend calculation logic (percentage normalization).

## Impact
- Affected specs: `asset-trend`
- Affected code: `src/services/__tests__/history.test.ts`, `src/services/__tests__/sync.test.ts`
