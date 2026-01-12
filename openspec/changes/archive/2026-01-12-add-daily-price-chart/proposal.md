# Proposal: Add Daily Price Chart

## Problem Statement
Users want to visualize the historical price performance of their assets directly within the application, similar to the experience provided by TradingView. Currently, only real-time (or near real-time) prices are shown, making it difficult to assess trends.

## Proposed Solution
Implement a daily price chart for each asset using `lightweight-charts` (by TradingView). This will involve:
1.  Extending the `priceService` to fetch historical k-line data (OHLCV).
2.  Creating a `PriceChart` component to render the historical data.
3.  Updating the asset details view (or a modal) to display this chart.

## Impact
- **User Experience**: Improved decision-making with visual trend analysis.
- **Performance**: Historical data fetching should be efficient and cached where possible.
- **Tech Stack**: Introduction of `lightweight-charts` for high-performance financial charting.

## Risks
- **API Limits**: Frequent historical data requests might hit rate limits of free APIs (Yahoo Finance/TWSE).
- **Data Availability**: Not all assets may have historical data available through the selected APIs.
- **Mobile Performance**: Ensure the chart is responsive and performs well on mobile devices.
