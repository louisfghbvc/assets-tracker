# assets-ui Specification (Asset Logos)

## MODIFIED Requirements

### Requirement: Asset List Display
The system SHALL list all assets with their identifiers and performance metrics.

#### Scenario: Display Brand Logo
- **GIVEN** an asset with a recognized symbol (e.g., NVDA, BTC)
- **WHEN** the asset list is displayed
- **THEN** the system SHOULD attempt to display a brand-specific logo instead of a generic icon.

#### Scenario: Logo Loading Failure
- **GIVEN** an asset with an unrecognized symbol or a network error
- **WHEN** the logo fails to load
- **THEN** the system MUST fallback to the standard generic icon (TrendingUp or Wallet).
