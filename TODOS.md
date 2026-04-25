# TODOS

## sync.ts — Replace substring header matching with exact alias matching

**What:** Replace `cell.includes('purchase')`, `cell.includes('updated')`, etc. in `parsePortfolioRows()` with an exact alias set. Example: `const PURCHASE_DATE_HEADERS = new Set(['purchasedate', 'purchase_date', 'purchasedatems'])`.

**Why:** The current substring matching creates a header collision class of bugs. Naming new Sheets columns requires checking that no header contains 'purchase', 'updated', 'source', etc. as a substring. Without this fix, every new readable column (like `DateReadable`) requires careful naming to avoid triggering the parser.

**Pros:** Permanently removes the constraint. New Sheets columns can be named descriptively without collision risk. Parser intent is explicit and auditable.

**Cons:** Small refactor (~15 lines in `parsePortfolioRows`). Needs a test update. Low risk — the alias set can include all current valid headers.

**Context:** Found during eng review of the purchase-date-ux plan (2026-04-25). The `DateReadable` naming convention is the current workaround. This is the principled fix.

**Depends on / blocked by:** Nothing — can be a standalone cleanup PR.
