# Tasks: Fix Exchange Asset Duplication

- [x] Normalize `exchangeName` to lowercase in `exchangeService.syncBalances`.
- [x] Implement balance aggregation in `fetchPionex` to sum quantities by coin.
- [x] Implement balance aggregation in `fetchBitoPro` to sum quantities by currency.
- [x] Simplify `recordId` generation to a stable format (e.g., `source-symbol`).
- [x] Add a one-time migration/cleanup to lowercase all `source` values in the existing `assets` table (via `syncBalances` cleanup).
- [x] Verify that syncing BitoPro multiple times does not increase the number of records.
