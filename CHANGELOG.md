# Changelog

All notable changes to this project will be documented in this file.

## [0.5.2] - 2026-04-27

### Added
- **In-app User Guide**: A full bilingual (ZH/EN) guide is now bundled at `/guide/` and built automatically during `npm run dev` / `npm run build`. The guide covers installation, adding assets, cloud sync, sell records, performance analysis, stats charts, trend chart, and exchange API setup — with annotated screenshots for each section.
- **Welcome banner**: First-time users see a dismissible banner linking directly to the guide. Banner is shown until explicitly dismissed (persisted in `localStorage`).
- **Guide link in Settings tab**: A "User Guide" button in the Settings tab lets users re-open the guide at any time.
- **Empty-state guide hint**: When the asset list is empty, a hint below the "no assets" message links to the guide.
- **Screenshot automation**: `scripts/take-screenshots.mjs` now covers all 5 guide sections — Stats (By Market + By Asset), Trend (chart + history), and Settings (exchange config) — in addition to the existing install / add-asset / sell flows.

### Fixed
- **First-open refresh gate**: `hasInitialRefreshed` was only set inside the `assetCount > 0` guard, so new users with zero assets never triggered post-load logic that depends on it. Now set unconditionally after the DB count check.
- **i18n coverage**: Banner greeting, guide link, and empty-state hint were using inline `language === 'zh' ? ... : ...` ternaries instead of the `t()` helper. All three now use proper translation keys (`guideBannerWelcome`, `guideBannerLink`, `guideHint`, `userGuide`).
- **PWA safety in `openGuide`**: The previous implementation fell back to `window.location.href = './guide/'` when `window.open` returned null — which happens by design with `noopener`. This destroyed PWA state. Fixed: pass `noopener,noreferrer` and remove the destructive fallback.
- **Screenshot script wrong IndexedDB stores**: The trend history seeder used `portfolioHistory` (wrong) instead of `history`, and `totalValueTWD` instead of `totalValue`. The settings seeder used `localStorage` instead of IndexedDB `exchangeConfigs`. Both are now correct.
- **Magic string duplication**: `'guide_banner_dismissed'` appeared in two places in `App.tsx`. Extracted to a module-scope `GUIDE_BANNER_KEY` constant.

## [0.5.1] - 2026-04-27

### Added
- **Stats tab — By Asset pie chart**: New "By Asset" view in the Stats tab shows each individual holding as its own slice, colored by market (blue for 台股, green for 美股, amber for 加密貨幣). The legend groups assets under a market header and shows each slice's percentage of total portfolio value.

### Fixed
- **Asset Performance Ranking now groups by symbol+market** — previously showed one row per buy transaction; now shows one row per asset with market-value-weighted CAGR and summed P&L across all lots. Resolves duplicate rows for multi-lot positions.

## [0.5.0] - 2026-04-25

### Added
- **Performance tab (績效)**: New tab in the main navigation shows portfolio-level analytics — annualized return (CAGR), holding period, and a benchmark comparison against TAIEX (^TWII) and S&P 500 (^GSPC).
- **Portfolio annualized return**: Market-value-weighted CAGR across all dated holdings. Assets missing a purchase date are excluded with a visible count warning.
- **Benchmark comparison**: Fetches the index price at your portfolio start date and compares your CAGR against both TAIEX and SPY simultaneously. Shows "Beating" / "Lagging" with the gap in percentage points.
- **Asset performance ranking**: Per-asset CAGR sorted from best to worst with unrealized P&L, so you can see your top and bottom performers at a glance.
- **Batch purchase-date setup**: If any assets lack a purchase date, a setup panel appears inline — enter all dates in one pass and save with a single button.
- **Annualized return utilities**: `src/utils/performance.ts` — pure functions for `annualizedReturn`, `portfolioAnnualizedReturn`, `benchmarkAnnualizedReturn`, `portfolioHoldingDays`, `portfolioStartDate`. All independently testable.
- **Benchmark fetch with 1-hour cache**: `priceService.fetchBenchmarkPrice()` — narrow epoch fetch for historical index prices with a module-level 1-hour cache (constant `BENCHMARK_CACHE_TTL_MS`) to avoid redundant API calls.

### Fixed
- Benchmark fetch effect now guards against stale results with a `cancelled` flag — navigating away before the fetch completes no longer overwrites the next view's state.
- Timezone-safe purchase date parsing: dates are stored as local midnight (`T00:00:00`) so the displayed date matches what the user entered regardless of timezone.
- `Math.min(...largeArray)` replaced with `.reduce()` in performance utils to prevent call stack overflow on large portfolios.
- `annualizedReturn` now returns `null` instead of `Infinity` for extreme short-hold gains — `Math.pow` result is guarded with `isFinite()`.
- Unrealized P&L column now correctly skips assets with `cost=0` (previously showed as 100% gain with no baseline).
- `handleSaveDates` guards against `NaN` asset IDs before calling `db.assets.update` — avoids a silent no-op when `asset.id` is undefined.
- Benchmark CORS-proxy allowlist narrowed from `['^TWII', '^GSPC', 'SPY']` to `['^TWII', 'SPY']` — `^GSPC` was dead code (the component only requests SPY).
- Portfolio annualized return label gets a ⓘ tooltip clarifying it is a weighted average of per-asset CAGRs (each using its own holding period), not a single-period total return.

### For contributors
- `SetupSection` is a module-level named component (not defined inside `PerformanceView`'s render) — this is required so React doesn't unmount it on every parent render, which caused focus loss on date inputs.
- `BENCHMARK_CACHE_TTL_MS = 60 * 60 * 1000` replaces the three former magic numbers in `price.ts`.
- All user-facing strings in `PerformanceView` are wired through the `t()` helper; no bare inline ternaries.

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
