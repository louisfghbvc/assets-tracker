# price-consistency Specification (Auto-Refresh)

## MODIFIED Requirements

### Requirement: Atomic Balance and Price Sync
The system SHALL ensure that after a full refresh, all assets (including those synced from external exchanges) display current market prices immediately, without a period of time showing $0.

#### Scenario: Automatic Refresh on Startup
- **GIVEN** a user with a valid session (Google Access Token)
- **WHEN** the application is opened or reloaded
- **THEN** it MUST automatically initiate a refresh of all asset prices and exchange balances.
- **AND** the sync status MUST indicate that a refresh is in progress.
