# TODOS

## App.tsx — Interactive onboarding tour (step-by-step walkthrough)

**What:** A tooltip-based step-by-step walkthrough that guides first-time users through the key UI elements: add-asset button, market selector, stats tab, trend tab, settings.

**Why:** The welcome banner + user guide cover "where to find help", but an in-app tour removes the need to leave the app at all. Especially useful on mobile where context-switching to a guide page interrupts flow.

**Pros:** Zero external navigation; inline contextual help at the moment of need; can reuse `HelpCircle` icon + existing `data-testid` attributes as anchors.

**Cons:** ~2-3 days of UI work to build the tooltip/overlay system; must handle scroll, tab switching, and responsive layouts. Save for v1.0 when user base is established.

**Context:** Deferred from v0.5.2 user guide onboarding plan (2026-04-27). The static guide + welcome banner are the v0.5.2 solution. This is the v1.0 follow-up.

**Depends on / blocked by:** v0.5.2 user guide must ship first (provides the content to link from the tour).

---

## sync.ts — Replace substring header matching with exact alias matching

**What:** Replace `cell.includes('purchase')`, `cell.includes('updated')`, etc. in `parsePortfolioRows()` with an exact alias set. Example: `const PURCHASE_DATE_HEADERS = new Set(['purchasedate', 'purchase_date', 'purchasedatems'])`.

**Why:** The current substring matching creates a header collision class of bugs. Naming new Sheets columns requires checking that no header contains 'purchase', 'updated', 'source', etc. as a substring. Without this fix, every new readable column (like `DateReadable`) requires careful naming to avoid triggering the parser.

**Pros:** Permanently removes the constraint. New Sheets columns can be named descriptively without collision risk. Parser intent is explicit and auditable.

**Cons:** Small refactor (~15 lines in `parsePortfolioRows`). Needs a test update. Low risk — the alias set can include all current valid headers.

**Context:** Found during eng review of the purchase-date-ux plan (2026-04-25). The `DateReadable` naming convention is the current workaround. This is the principled fix.

**Depends on / blocked by:** Nothing — can be a standalone cleanup PR.

## performance.ts — Realized P&L by Calendar Year (Tax Report View)

**What:** 在績效頁籤加入「已實現損益年報」區塊，依年份整理 SellRecords：賣出標的、已實現損益、持有天數、手續費。

**Why:** 資料已全在 `sellRecords` 表，零新邏輯。報稅季最直接實用的功能，使用者不需要另開 Google Sheets 手動加總。

**Pros:** 零新 API call；DB 資料現成；可顯示短期/長期損益分類（持有 < 365 天 vs ≥ 365 天）。

**Cons:** UI 工作量（Table + 年份 tab）；短期/長期稅率分界依國家而異（台灣/美股規則不同），顯示時需注意不要誤導。

**Context:** 在 `/plan-ceo-review` 數據分析規劃（2026-04-26）中評估，選為下一批 analytics 功能後延後處理。A（走勢圖）、B（貢獻度）、D（熱力圖）優先。

**Depends on / blocked by:** 無，可獨立出貨。

## news.ts — Inline news on asset cards

**What:** Show the latest news headline per symbol directly in the asset list row. Tapping/hovering triggers a popover with 3 headlines. Eliminates the need to switch to the News tab just to check news for one specific holding.

**Why:** The News tab groups all holdings together. When you want context on a single position that just moved, clicking into that asset's card is the natural action — not navigating to a separate tab.

**Pros:** Higher contextual relevance; zero new data fetching (reuses newsService from the News tab); fast perceived response from cache.

**Cons:** UI work for popover positioning (must handle overflow, mobile, and scroll); adds complexity to the asset card component which is already fairly dense.

**Context:** Deferred from the News tab plan (2026-05-05). The News tab is the v0.6.x solution. This is the logical next iteration.

**Depends on / blocked by:** News tab (news.ts + NewsTab.tsx) must ship first.

---

## news.ts — RSS fallback if Yahoo Finance search endpoint breaks

**What:** If `query1.finance.yahoo.com/v1/finance/search` returns 403 or drifts its response shape consistently, switch to Google News RSS per symbol as a fallback data source.

**Why:** Yahoo Finance search is an unofficial endpoint with no SLA. It has historically been rate-limited or shape-changed without notice. A silent fallback prevents the entire News tab going dark without user-visible explanation.

**Pros:** Resilience. Google News RSS (`news.google.com/rss/search?q=NVDA+stock`) is stable, has real news, and requires only an XML parser. No API key needed.

**Cons:** Adds an XML parsing code path (DOMParser). TW symbols need company name lookup for meaningful Google News results (2330.TW → search for company name, not the ticker). Medium complexity.

**Context:** Flagged during the News tab CEO review (2026-05-05). The inline shape guard `Array.isArray(data?.news)` is the current mitigation. This is the principled fallback.

**Effort estimate:** S (CC ~15 min once triggered) | **Priority:** P3
**Depends on / blocked by:** News tab must ship first. Trigger this TODO if error logging shows repeated Yahoo Finance failures.

---

## performance.ts — Include realized gains (SellRecords) in portfolio annualized return

**What:** Extend `portfolioAnnualizedReturn()` to include closed positions (fully sold assets). Use `SellRecord.purchaseDateSnapshot`, `SellRecord.holdingDays`, and `SellRecord.realizedGain` to compute a time-weighted return that covers both open and closed positions.

**Why:** The current v0.5.0 implementation covers only unrealized (held) positions. If you sold TSMC at a big gain last year, that gain is invisible in your portfolio annualized return. The schema already stores everything needed: `purchaseDateSnapshot` and `holdingDays` on `SellRecord`.

**Pros:** More honest total-portfolio picture. No schema changes needed — all required fields already exist in `SellRecord`. The `sellRecords` Dexie table is already queryable.

**Cons:** Calculation logic is more complex: combining time-weighted returns across open and closed positions requires a modified Dietz or IRR approximation. The simple weighted-average formula used for open positions doesn't directly extend to closed ones.

**Context:** Explicitly deferred from the v0.5.0 績效 tab design (2026-04-25). The design doc noted this as Future Enhancement. Raised again during eng review as a trackable item.

**Depends on / blocked by:** v0.5.0 績效 tab must ship first.
