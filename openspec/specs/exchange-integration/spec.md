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

