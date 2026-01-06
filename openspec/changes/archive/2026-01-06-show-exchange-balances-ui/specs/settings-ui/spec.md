# Capability: Exchange Integration UI

## ADDED Requirements
### Requirement: Exchange Balance Summary
The system SHALL display the total market value of all assets synced from a specific exchange.

#### Scenario: View Exchange Totals
- **GIVEN** the user has synced assets from Pionex
- **WHEN** the user navigates to the Settings tab
- **THEN** the Pionex connection card MUST show the total value of those assets in the primary currency.

### Requirement: Asset Source Identification
The system SHALL clearly distinguish between manual and exchange-synced asset records.

#### Scenario: Verify Record Source
- **GIVEN** an asset with multiple records (e.g. BTC from Manual and BitoPro)
- **WHEN** the user expands the asset card
- **THEN** each individual record MUST display its source ("Manual", "BitoPro", etc).
