# sync Specification

## Purpose
TBD - created by archiving change sync-exchange-configs. Update Purpose after archive.
## Requirements
### Requirement: Portfolio Backup
The system SHALL backup all manual asset records to the `Portfolio` tab in the `AssetsTracker_DB` Google Spreadsheet.

#### Scenario: Manual Upload
- **GIVEN** the user has local asset records
- **WHEN** the user triggers "Back up to cloud"
- **THEN** the records must be uploaded to the `Portfolio` tab.

### Requirement: Exchange Configuration Backup
The system SHALL backup all exchange API configurations to the `ExchangeConfigs` tab in the `AssetsTracker_DB` Google Spreadsheet.

#### Scenario: Secure Configuration Backup
- **GIVEN** the user has linked Pionex or BitoPro accounts
- **WHEN** the user triggers "Back up to cloud"
- **THEN** the API Key and API Secret must be uploaded to the `ExchangeConfigs` tab.

### Requirement: Global Data Restoration
The system SHALL restore both portfolio assets and exchange configurations when a cloud restore is triggered.

#### Scenario: Full Cloud Restore
- **GIVEN** a spreadsheet exists with `Portfolio` and `ExchangeConfigs` tabs
- **WHEN** the user triggers "Restore from cloud"
- **THEN** both local assets and exchange configurations must be replaced with the cloud data.

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

