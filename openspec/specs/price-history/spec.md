# price-history Specification

## Purpose
TBD - created by archiving change add-daily-price-chart. Update Purpose after archive.
## Requirements
### Requirement: Historical Data Fetching
The system SHALL be able to fetch historical price data for a given asset.

#### Scenario: Fetching daily OHLC data for a US stock
- Given a valid US stock symbol (e.g., "AAPL")
- When the `priceService.fetchHistory` is called with "AAPL"
- Then the system MUST return an array of daily price points (Open, High, Low, Close, Time) for the requested range.

#### Scenario: Fetching daily OHLC data for a Taiwan stock
- Given a valid Taiwan stock symbol (e.g., "2330.TW")
- When the `priceService.fetchHistory` is called with "2330.TW"
- Then the system MUST return an array of daily price points.

### Requirement: Chart Visualization
The system SHALL display an interactive price chart for an asset.

#### Scenario: View chart in Asset Detail
- Given the user has selected an asset
- When the user views the asset details
- Then an interactive k-line chart MUST be displayed.
- And the user MUST be able to toggle between different time ranges (1M, 3M, 1Y).

#### Scenario: Loading state and error handling
- When historical data is being fetched
- Then a loading indicator MUST be shown within the chart area.
- If the fetch fails
- Then an error message MUST be displayed to the user.

