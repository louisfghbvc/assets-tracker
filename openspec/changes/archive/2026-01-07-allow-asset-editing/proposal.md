# Proposal: Add Asset Editing and Cost/Source Persistence

## Why
1. **Missing Exchange Cost Basis**: Assets synced from Pionex or BitoPro currently show a cost of 0 because the API doesn't provide cost basis data. Users need a way to manually enter their average purchase price to see accurate profit/loss.
2. **Persistence during Sync**: Currently, re-syncing an exchange overwrites all local records, resetting any manually entered data to 0. 
3. **Manual Correction**: Users might make mistakes when adding manual assets and should be able to correct them without deleting and re-adding.
4. **Symbol & Source Discrepancy**: Cloud-synced data currently loses its "Source" field and sometimes uses inconsistent symbols (e.g., `BTC` vs `BTC-USD`), leading to duplicate entries when exchange sync runs.

## What Changes
1. **UI: Record Item Editing**: Add an "Edit" button to individual records in the expanded asset view.
2. **UI: Edit Mode**: Implement an inline editing or modal interface to update asset details (Cost for all; Cost and Quantity for manual assets).
3. **Logic: Cost Basis Migration**: Update `exchangeService.syncBalances` to preserve existing user-defined costs when replacing assets from the API.
4. **Logic: DB Update**: Add a helper to update asset records in the local database.
5. **Logic: Symbol Normalization**: Ensure crypto symbols are normalized to `SYMBOL-USD` during cloud restoration to prevent duplicates with exchange data.

## Design
- **Cost Persistence**: 
  - Before an exchange sync deletes local records, it will cache the current `symbol -> cost` mapping for that source.
  - After fetching new balances, it will re-apply the cached costs to the new records.
- **Editing Restriction**: 
  - Synced assets: Only `cost` is editable.
  - Manual assets: `quantity`, `cost`, and `name` are editable.
