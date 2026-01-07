# Proposal: Fix Crypto Price Flicker

## Problem
When the user refreshes the application, cryptocurrency prices are momentarily displayed and then reset to $0. 

### Root Cause
In `App.tsx`, the `handleRefresh` function performs updates in the following order:
1. Fetch and update prices for existing assets in the database.
2. Sync exchange balances (Pionex, BitoPro).

The exchange sync process (`exchangeService.syncBalances`) deletes existing assets for that source and re-adds them from the API. Since the newly added assets from the API do not have a `currentPrice` field initially, and the price update step has already passed, the UI renders them with a price of $0 until the next refresh or manual update.

## Proposed Solution
Reorder the refresh logic in `App.tsx`:
1. **Sync Exchange Balances**: Update the asset list and quantities from external exchanges first.
2. **Fetch and Update Prices**: Once the asset list is current, fetch and apply prices to all assets (manual and synced).

This ensures that the latest assets from exchanges are present in the database before the price update step runs.

## Impact
- Correct price display after refresh for all assets.
- Elimination of the "flicker" where prices disappear.
