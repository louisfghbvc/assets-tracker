# Tasks: Enhance Asset Trend

## 1. Data Model & Database Storage
- [x] Update `HistoryRecord` in `database.ts` to include an optional `note` field.
- [x] Update `historyService` to allow saving/updating notes for specific dates.
- [x] Update `syncService` and `googleSheets.ts` to sync the `note` field to the "History" sheet.

## 2. TrendChart Component Enhancements
- [x] Refactor `TrendChart.tsx` to accept a `mode` prop ('value' | 'percent').
- [x] Implement percentage normalization logic in `TrendChart`.
- [x] Update `lightweight-charts` configuration for smooth curves (`curveType: 1`).
- [x] Add event marker support using `series.setMarkers`.
- [x] Implement dynamic line color based on start vs end value of the current range.

## 3. App UI/UX Integration
- [x] Add mode toggle (Total vs Profit %) to the `trend-view` section.
- [x] Add range selector (1W, 1M, 3M, 1Y, MAX) above the trend chart.
- [x] Add a way to add/edit notes for the current day's snapshot (e.g., a simple text input in the trend view).
- [x] Improve the responsiveness of the trend chart on mobile devices.

## 4. Documentation & Validation
- [x] Update translations for new labels (Total, Profit %, 1W, 1M, etc.).
- [x] Verify that Google Apps Script still works with the new "Notes" column.
- [x] Manual verification of chart accuracy in both modes.
