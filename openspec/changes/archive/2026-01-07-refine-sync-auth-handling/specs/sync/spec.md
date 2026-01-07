# sync Specification Delta

## ADDED Requirements

### Requirement: Session Expiry Handling
The system SHALL detect expired Google OAuth sessions and prompt the user to re-authenticate instead of reporting specific API failures.

#### Scenario: Token Expired During Backup
- **GIVEN** an expired or invalid `accessToken`
- **WHEN** the user attempts to "Back up to cloud"
- **THEN** the system MUST detect the `401 Unauthorized` response.
- **AND** the system MUST log the user out and display a "Session expired" message.

#### Scenario: Token Expired During Drive Search
- **GIVEN** an expired `accessToken`
- **WHEN** the system searches for an existing spreadsheet in Google Drive
- **THEN** the system MUST avoid reporting a "Drive API Error".
- **AND** the system MUST trigger the logout flow.
