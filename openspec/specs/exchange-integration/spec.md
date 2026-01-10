# exchange-integration Specification

## Purpose
TBD - created by archiving change fix-pionex-api-timestamp. Update Purpose after archive.
## Requirements
### Requirement: Pionex API Authentication
The system MUST correctly authenticate private GET requests to the Pionex API.

#### Scenario: Successful Balance Fetch
- **GIVEN** a valid Pionex API Key and Secret
- **WHEN** fetching account balances
- **THEN** the request MUST include a `timestamp` query parameter.
- **AND** the signature MUST be calculated using the full URL including the query string.

### Requirement: Exchange Sync Transparency
The system SHALL inform the user about the scope of exchange data synchronization.

#### Scenario: Verify Sync Scope Tip
- **GIVEN** the user is viewing the Settings tab
- **WHEN** looking at the Exchange Connections section
- **THEN** a tip MUST exist explaining that bot/earn account balances are not included in the sync.

### Requirement: Automated Exchange Sync
The system SHALL synchronize asset quantities from supported exchanges (Pionex, BitoPro).

#### Scenario: Aggregated Balance Update
- **GIVEN** an exchange API returns multiple balance entries for the same currency (e.g. Spot and Grid)
- **WHEN** the sync is performed
- **THEN** the system MUST sum these quantities.
- **AND** create exactly ONE database record for that currency per exchange.

#### Scenario: Idempotent Sync
- **GIVEN** existing assets synced from an exchange
- **WHEN** a new sync is performed
- **THEN** it MUST completely replace old records from that exchange without creating duplicates.
- **AND** normalization MUST be applied to prevent casing mismatches (e.g., 'bitopro' vs 'BitoPro').

