# Changelog

All notable changes to this project will be documented in this file.

## [0.4.0] - 2026-04-25

### Added
- **Holding days display**: Each asset card now shows how long you've held the position (e.g., "持有天數: 831 天") when a purchase date is set. No purchase date? The field is hidden entirely rather than showing zero.
- **Date-only purchase date input**: Add, Edit, and Sell modals now use a proper date picker (`type="date"`) instead of a combined date-time input. You pick the date; the app handles midnight-in-your-timezone so there's no off-by-one when you're outside UTC.
- **Human-readable Sheets columns**: Google Sheets backup now includes `DateReadable` (YYYY-MM-DD) alongside the raw `PurchaseDate` timestamp, `SellDateReadable`, and `PurchaseDateSnapshotReadable` in the sell records sheet. The spreadsheet is now readable without a timestamp converter.
- **Traditional Chinese user guide**: `docs/user-guide.md` — full walkthrough in 繁體中文 covering install, adding your first asset, Google Sheets sync, and recording a sell with P&L.
- **Screenshot automation**: `scripts/take-screenshots.mjs` — Playwright script to regenerate the 10 guide screenshots when the UI changes.

### Fixed
- Sell modal success toast now auto-dismisses correctly when a synthetic (empty-picture) user profile is active — fixed a React prop warning caused by `<img src="">` on empty avatar URLs.
- `AddAssetModal` now initializes `purchaseDate` to local midnight (not `Date.now()`) so the stored timestamp doesn't include time-of-day when the user never touches the date field.

### For contributors
- `type="date"` replaces `type="datetime-local"` in all three modals. Parse new dates with `new Date(y, m-1, d).getTime()` (local midnight) not `new Date(dateString).getTime()` (UTC midnight).
- Sheets column naming: new readable columns must NOT contain `'purchase'`, `'updated'`, or `'source'` as a substring — the sync parser uses `includes()` matching. See TODOS.md for the principled fix.

## [0.3.0] - 2026-04-25

### Added
- **Sell assets**: You can now record a sell for any asset — enter quantity, sell price, date, and optional fees. The position is reduced (or closed) atomically.
- **Realized P&L**: Each sell shows your gain/loss at the moment of the sale, with a live preview before you confirm. Gain is shown in both asset currency and TWD.
- **Closed positions tab**: Assets you've fully sold move to a "Closed Positions" view so your active portfolio stays clean.
- **Sell history**: Every sell is stored as a `SellRecord` in the local database (Dexie v7 schema) with date, price, quantity, and fees.
- **Cloud sync for sell records**: Sell history syncs to Google Sheets (a dedicated `SellRecords` sheet) on backup/restore alongside your portfolio.
- **Backdate support**: Sell date defaults to today but can be set to any past date. A visual flag appears when you enter a backdated sell.

### Fixed
- Sell modal error message now clears immediately when you change any input field (previously it lingered after correcting).
- Sell success toast now auto-dismisses after 3 seconds.

### For contributors
- `SellRecord` schema added to `src/db/database.ts`; `sellAsset()` in `src/services/portfolio.ts` handles the atomic deduct-and-record transaction.
- 12 new tests for `sellAsset()` covering all validation branches and edge cases.

## [0.2.0] - 2026-04-25

### Added
- **Purchase date tracking**: Assets now store an optional `purchaseDate` timestamp
- Add Asset modal includes a `datetime-local` field defaulting to the current time; resets on close
- Edit Asset modal includes an editable `datetime-local` field for all asset sources (including exchange-synced)
- Individual asset record rows display the purchase date using `toLocaleString()` or `—` when absent
- Exchange sync (`syncBalances`) preserves the user-set `purchaseDate` across re-syncs
- Google Sheets backup/restore writes and reads `purchaseDate` as a 10th column (`PurchaseDate`, column J)
- Translation keys `purchaseDate` added for both `en` and `zh-TW`

### Fixed
- `parseInt` without radix in `sync.ts` portfolio row parser
- Epoch-0 timestamp being silently swallowed to `undefined` by `parseInt(...) || undefined` pattern
- Unnecessary `any` cast on `Asset.purchaseDate` in `exchange.ts` (field already typed on interface)
- `NaN` persisted to state when `datetime-local` input is cleared (now falls back to `Date.now()` / `undefined`)

### Tests
- 13 new tests covering: `parsePortfolioRows` purchaseDate paths (6), `syncBalances` purchaseDateMap preservation (2), `updatePortfolio` column J header and range (3), App `record-purchase-date` span display (2)
- Total: 91 passing (4 pre-existing `price.test.ts` failures unrelated to this feature)
