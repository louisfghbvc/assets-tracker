# assets-ui Specification

## Purpose
TBD - created by archiving change show-exchange-balances-ui. Update Purpose after archive.
## Requirements
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

### Requirement: Asset Detail Editing
The system SHALL allow users to modify the properties of existing assets to correct errors or update cost basis information.

#### Scenario: Editing Manual Asset
- **GIVEN** a manual asset record
- **WHEN** the user edits the record
- **THEN** they MUST be able to update quantity, cost, and name.

#### Scenario: Editing Synced Asset Cost
- **GIVEN** an asset synced from Pionex or BitoPro
- **WHEN** the user edits the record
- **THEN** they MUST be able to update the cost basis.
- **AND** the quantity MUST remain read-only as it is source-dependent.
- **AND** the updated cost MUST persist across exchange synchronizations.
+
+### Requirement: Crypto Symbol Normalization
+The system SHALL ensure crypto symbols are stored in a standard format to prevent duplicates between manual/cloud data and exchange-synced data.
+
+#### Scenario: Restoring BTC from Cloud
+- **GIVEN** a cloud backup row with symbol `BTC` and market `Crypto`
+- **WHEN** the user performs a cloud restoration
+- **THEN** the system MUST save it to the local database as `BTC-USD`.
+

