## 1. Database Schema

- [x] 1.1 Add `purchaseDate?: number` to the `Asset` interface in `src/db/database.ts`
- [x] 1.2 Add Dexie `version(6)` — no `.stores()` change needed (field is stored automatically without indexing); bump version is required to trigger the future-proofing type update
- [x] 1.3 No data migration needed: leave `purchaseDate` as `undefined` for all existing assets so they show '—' in the UI. Do NOT use `lastUpdated` as a default — it is overwritten by every price refresh and exchange sync, making it garbage data as a purchase date approximation

## 2. Add Asset Modal

- [x] 2.1 Add `purchaseDate` state (default to `Date.now()`) in `AddAssetModal.tsx`; also add `setPurchaseDate(Date.now())` to the existing close reset `useEffect` (the one that resets symbol/name/quantity/cost) so re-opening shows a fresh date, not a stale one
- [x] 2.2 Add a `<input type="datetime-local">` field with a label in the add form
- [x] 2.3 Include `purchaseDate` in the object passed to `db.assets.add()`

## 3. Edit Asset Modal

- [x] 3.1 Add `purchaseDate` state initialized from `asset.purchaseDate` (no lastUpdated fallback — undefined is fine; the input stays empty and shows placeholder) in `EditAssetModal.tsx`
- [x] 3.2 Add a `<input type="datetime-local">` field (editable for all asset sources) in the edit form
- [x] 3.3 Convert stored timestamp to `YYYY-MM-DDTHH:MM` local format: `new Date(ts - new Date(ts).getTimezoneOffset() * 60000).toISOString().slice(0, 16)` (NOT `.toISOString().slice(0,16)` directly — that gives UTC time, not local)
- [x] 3.4 Convert input string back to Unix ms timestamp on form submit
- [x] 3.5 Include `purchaseDate` in the `db.assets.update()` call

## 4. Asset Card Display

- [x] 4.1 In `App.tsx` at the `items.map()` section (line ~805), add `purchaseDate` display to each individual record row (inside `.record-info`, alongside the existing qty/cost/source spans) — NOT in `.position-summary` (that's aggregate stats; a single date there is ambiguous for symbols with multiple buy records)
- [x] 4.2 Show the formatted date if `item.purchaseDate` is set, or omit/show "—" when absent
- [x] 4.3 Format using `toLocaleString()` (not `toLocaleDateString()`) to show both date and time — the plan stores full timestamp precision and the rationale mentions intra-day traders

## 5. Exchange Sync Preservation

- [x] 5.1 In `src/services/exchange.ts` `syncBalances()`, before the `.delete()` call at line ~108: query existing assets for that source and build a `Map<string, number>` of `symbol → purchaseDate`
- [x] 5.2 After `bulkAdd()`: for each newly added row, if its symbol exists in the preserved map, call `db.assets.where('symbol').equals(symbol).and(a => a.source === source).modify({ purchaseDate: preservedDate })` to restore the user's edited date

## 6. Cloud Backup / Restore (Google Sheets)

- [x] 6.1 In `src/services/googleSheets.ts` `updatePortfolio()`: add `asset.purchaseDate ?? ''` as a 10th column in the values array, and add `'PurchaseDate'` to the header row
- [x] 6.2 In `src/services/sync.ts` `parsePortfolioRows()`: detect `purchaseDate` column by header (e.g., `cell.includes('purchase') || cell.includes('PurchaseDate')`); update the fallback `colMap` default to include `purchaseDate: 9`; parse it as `parseInt(row[colMap.purchaseDate]) || undefined`

## 7. Translations

- [x] 7.1 Add translation keys for "purchaseDate" label in `src/translations.ts` (zh-TW and en)

## 8. Tests

- [x] 8.1 `EditAssetModal.test.tsx`: add test — `purchaseDate` input renders with a value when `asset.purchaseDate` is set; verify the formatted string matches expected local-time output (regression test for the UTC/offset conversion)
- [x] 8.2 `EditAssetModal.test.tsx`: add test — synced asset (source: 'pionex') has `purchaseDate` input enabled (editable), unlike the quantity input which is disabled
- [x] 8.3 `EditAssetModal.test.tsx`: add test — form submit calls `db.assets.update` with `purchaseDate` included
- [x] 8.4 `AddAssetModal.test.tsx`: add test — `db.assets.add` is called with `purchaseDate` included in the submitted object (closes gap in existing `objectContaining` submit tests)
- [x] 8.5 `AddAssetModal.test.tsx`: add test — re-opening the modal (close then re-open) shows a fresh purchase date, not a stale one from the previous open
