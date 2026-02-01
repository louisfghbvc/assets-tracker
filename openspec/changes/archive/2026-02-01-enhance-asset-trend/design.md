# Design: Enhance Asset Trend

## Architecture Overview
The enhancement involves updating the `TrendChart` React component, the `historyService`, and the `App.tsx` container.

### Component Structure
- **TrendChart**: Will be updated to use `lightweight-charts` more extensively (LineSeries with curve interpolation, Markers for events).
- **TrendView (in App.tsx)**: Will include new UI controls for mode switching (Value vs %) and time range selection.

### Data Model Updates
- **HistoryRecord**: Already exists. We will extend the storage or handling to include optional `note` fields for event markers.
- **Normalization Logic**: To support the "Profit %" mode, the chart will need to calculate percentage changes relative to the first visible data point in the selected range.

### UI/UX Improvements
- **Smooth Curves**: Using `lightweight-charts` line series options.
- **Dynamic Gradients**: Enhancing the `AreaSeries` styles.
- **Event Markers**: Using the `setMarkers` API of `lightweight-charts` to show pins/notes on the time scale.

## Alternatives Considered
- **Recharts for Trend**: While Recharts is used for Pie charts, `lightweight-charts` is superior for high-performance time-series data and has a more "financial" look. We will stick with `lightweight-charts`.

## Security & Privacy
- Markers are stored locally in IndexedDB and synced to Google Sheets, maintaining user privacy.
