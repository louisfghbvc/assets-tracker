# Proposal: Fix Exchange Asset Duplication

## Why
Users are experiencing data duplication when refreshing exchange balances. This occurs because the synchronization logic does not properly idempotentize records, and manual/exchange records can clash or multiply due to case-sensitivity in source naming.

## What Changes
- Normalize all exchange source names to lowercase in the database.
1. **Case-sensitivity issues**: The `source` field in the database might have mixed casing (e.g., `bitopro` vs `BitoPro`), preventing the `delete` operation from clearing old records before adding new ones.
2. **Segmented API Responses**: Exchange APIs occasionally return balance for the same currency across multiple sub-wallets or bots (especially Pionex). Our current implementation creates a separate database record for each entry, leading to duplicates in the expanded view.
3. **Inconsistent Record IDs**: Record IDs are currently timestamped during every sync, which doesn't serve as a stable identifier if the cleanup logic fails.

## Proposed Solution
- **Normalize Source Names**: Force all `source` and `exchangeName` values to lowercase before database operations.
- **Balance Aggregation**: Group balances by symbol/currency at the service level before saving to the database. This ensures one database record per asset per exchange.
- **Stable Record IDs**: Change `recordId` to a deterministic format (e.g., `exchange-symbol`) to ensure consistency.
- **Case-Insensitive Deletion**: Ensure the cleanup step in `syncBalances` handles case variations or is preceded by normalization.

## Goals
- Eliminate duplicate asset records for the same symbol from the same exchange.
- Ensure "Source" identification is robust across sync and cloud backup/restore.
