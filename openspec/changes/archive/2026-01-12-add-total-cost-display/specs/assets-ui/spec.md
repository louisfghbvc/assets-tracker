# assets-ui Spec Delta

## ADDED Requirements

### Requirement: Total Cost Visibility
The application SHALL provide a clear view of the total cost (total amount invested) for each asset group within the asset list details.

#### Scenario: Viewing Total Cost in Expanded Card
- **GIVEN** a user has multiple purchase records for a single asset (e.g., TSMC)
- **WHEN** the user clicks to expand the asset card
- **THEN** a "Total Cost" field MUST be visible.
- **AND** the value MUST represent the sum of all purchase costs (Quantity * Cost) for that asset.
- **AND** the value MUST be formatted according to the asset's market currency.
