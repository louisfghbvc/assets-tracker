# profit-display Specification

## Purpose
TBD - created by archiving change show-absolute-profit. Update Purpose after archive.
## Requirements
### Requirement: Asset List Display
The system SHALL list all assets with their value and performance metrics.

#### Scenario: Display Absolute Profit
- **GIVEN** an asset with a cost basis of $100 and a current value of $150
- **WHEN** the asset is displayed in the list
- **THEN** it MUST show the absolute profit of `+$50` and the percentage `+50%`.

### Requirement: Total Balance Overview
The system SHALL show the aggregate performance of the entire portfolio.

#### Scenario: Display Total Profit
- **GIVEN** multiple assets in the portfolio
- **WHEN** the header is rendered
- **THEN** it MUST display the total profit (Total Value - Total Cost) in absolute terms.
- **AND** the label MUST clearly indicate this is "Total Profit".

