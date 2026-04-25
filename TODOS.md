# TODOS

## sync.ts — Replace substring header matching with exact alias matching

**What:** Replace `cell.includes('purchase')`, `cell.includes('updated')`, etc. in `parsePortfolioRows()` with an exact alias set. Example: `const PURCHASE_DATE_HEADERS = new Set(['purchasedate', 'purchase_date', 'purchasedatems'])`.

**Why:** The current substring matching creates a header collision class of bugs. Naming new Sheets columns requires checking that no header contains 'purchase', 'updated', 'source', etc. as a substring. Without this fix, every new readable column (like `DateReadable`) requires careful naming to avoid triggering the parser.

**Pros:** Permanently removes the constraint. New Sheets columns can be named descriptively without collision risk. Parser intent is explicit and auditable.

**Cons:** Small refactor (~15 lines in `parsePortfolioRows`). Needs a test update. Low risk — the alias set can include all current valid headers.

**Context:** Found during eng review of the purchase-date-ux plan (2026-04-25). The `DateReadable` naming convention is the current workaround. This is the principled fix.

**Depends on / blocked by:** Nothing — can be a standalone cleanup PR.

## performance.ts — Include realized gains (SellRecords) in portfolio annualized return

**What:** Extend `portfolioAnnualizedReturn()` to include closed positions (fully sold assets). Use `SellRecord.purchaseDateSnapshot`, `SellRecord.holdingDays`, and `SellRecord.realizedGain` to compute a time-weighted return that covers both open and closed positions.

**Why:** The current v0.5.0 implementation covers only unrealized (held) positions. If you sold TSMC at a big gain last year, that gain is invisible in your portfolio annualized return. The schema already stores everything needed: `purchaseDateSnapshot` and `holdingDays` on `SellRecord`.

**Pros:** More honest total-portfolio picture. No schema changes needed — all required fields already exist in `SellRecord`. The `sellRecords` Dexie table is already queryable.

**Cons:** Calculation logic is more complex: combining time-weighted returns across open and closed positions requires a modified Dietz or IRR approximation. The simple weighted-average formula used for open positions doesn't directly extend to closed ones.

**Context:** Explicitly deferred from the v0.5.0 績效 tab design (2026-04-25). The design doc noted this as Future Enhancement. Raised again during eng review as a trackable item.

**Depends on / blocked by:** v0.5.0 績效 tab must ship first.
