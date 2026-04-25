# Changelog

All notable changes to this project will be documented in this file.

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
