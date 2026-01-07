# Capability: Exchange Integration

## ADDED Requirements
### Requirement: Exchange Sync Transparency
The system SHALL inform the user about the scope of exchange data synchronization.

#### Scenario: Verify Sync Scope Tip
- **GIVEN** the user is viewing the Settings tab
- **WHEN** looking at the Exchange Connections section
- **THEN** a tip MUST exist explaining that bot/earn account balances are not included in the sync.
