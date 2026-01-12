# Tasks: Add Daily Price Chart

## Core Infrastructure

- [x] Install `lightweight-charts` dependency.
- [x] Extend `priceService` in `src/services/price.ts` to include `fetchHistory` method.
- [x] Update Tauri backend (if necessary) to proxy historical data requests to bypass CORS.

## UI Components

- [x] Create `src/components/PriceChart.tsx` component using `lightweight-charts`.
- [x] Implement loading and error states in `PriceChart`.
- [x] Add range selection buttons (1M, 3M, 1Y, 5Y) to the chart UI.

## Integration

- [x] Create an `AssetDetailModal` or update existing asset interaction to show the chart.
- [x] Ensure the chart is responsive and looks premium on mobile and desktop.
- [x] (Optional) Implement basic caching for historical data using Dexie.

## Validation

- [x] Verify historical data fetching for US stocks.
- [x] Verify historical data fetching for Taiwan stocks.
- [x] Verify historical data fetching for Crypto.
- [x] Test chart interactions (scrolling, zooming, hovering).
- [x] Verify UI responsiveness on various screen sizes.
