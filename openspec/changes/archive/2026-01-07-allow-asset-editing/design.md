# Design: Asset Editing and Cost Persistence

## UI: Inline Edit / Modal
- Add a `Pencil` icon next to each record.
- When clicked, open a small modal `EditAssetModal`.
- For `source: 'pionex' | 'bitopro'`, the `quantity` input is disabled or hidden (informational only).
- For `source: 'manual'`, both `quantity` and `cost` are editable.

## Logic: Cost Basis Persistence
In `src/services/exchange.ts`, modify `syncBalances`:
1. Fetch existing assets for the specific `exchangeName`.
2. Create a map `existingCosts: Map<string, number>`.
3. Perform the API fetch.
4. For each newly fetched asset, check if its symbol exists in `existingCosts`.
5. If it exists, use that cost instead of default `0`.
6. Proceed with `bulkAdd`.

## Logic: Symbol Normalization
In `src/services/sync.ts`, modify `parsePortfolioRows`:
1. When parsing a row, if the type is `crypto` (or market is `Crypto`):
   - Check if the symbol contains a `-`.
   - If not, append `-USD` to it.
2. This ensures that assets like `BTC` from the cloud are mapped to `BTC-USD` before being inserted into the database, matching the `exchangeService` output.

## Translations
Add new keys to `translations.ts`:
- `editAsset`: "編輯資產" / "Edit Asset"
- `saveChanges`: "儲存變更" / "Save Changes"
- `quantityReadOnly`: "同步資產的數量由交易所提供" / "Quantity is managed by the exchange"
