# Capability: Exchange Integration

## ADDED Requirements
### Requirement: Pionex API Authentication
The system MUST correctly authenticate private GET requests to the Pionex API.

#### Scenario: Successful Balance Fetch
- **GIVEN** a valid Pionex API Key and Secret
- **WHEN** fetching account balances
- **THEN** the request MUST include a `timestamp` query parameter.
- **AND** the signature MUST be calculated using the full URL including the query string.
