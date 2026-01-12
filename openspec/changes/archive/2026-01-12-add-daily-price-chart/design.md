# Design: Daily Price Chart

## Implementation Overview
The task is to introduce a daily price chart for assets. We will use `lightweight-charts` for its performance and TradingView-like look and feel.

## Architecture Change

### 1. Data Fetching (`priceService`)
- Add `fetchHistory(symbol: string, range: string, interval: string)` to `priceService`.
- **Yahoo Finance**: Support `range=1mo`, `3mo`, `1y`, `5y` and `interval=1d`.
- **Taiwan Stocks**: Use Yahoo symbols (append `.TW` for TSE, `.TWO` for OTC) to fetch historical data as it's more consistent than scraping TWSE's historical CSVs.
- **Tauri Integration**: Add a corresponding `invoke` command in Rust if needed for better CORS handling, similar to `fetch_prices`.

### 2. UI Component (`PriceChart`)
- Create a reusable `PriceChart` component.
- Use `lightweight-charts` to render OHLC or Area charts.
- Support switching between different time ranges (1M, 3M, 1Y, All).
- Design it to be responsive, fitting well in both desktop and mobile layouts.

### 3. Integration Point
- Option A: Add a "Show Chart" button on each asset card (modal).
- Option B: Expand the asset card to show a mini-chart (sparkline) and a full chart on click.
- **Decision**: Start with a modal/detail view reached by clicking the asset card to keep the main list clean.

## Data Model
The historical data will follow the `lightweight-charts` format:
```typescript
interface CandlestickData {
    time: string; // "YYYY-MM-DD"
    open: number;
    high: number;
    low: number;
    close: number;
}
```

## Risks & Mitigations
- **Rate Limiting**: Cache historical data locally (Dexie.js) to avoid redundant requests.
- **Library Size**: `lightweight-charts` is quite light (~45KB gzipped), so impact on bundle size is minimal.
- **Complexity**: Handling different timezones and market hours. We'll stick to UTC or the asset's local date for simplicity.
