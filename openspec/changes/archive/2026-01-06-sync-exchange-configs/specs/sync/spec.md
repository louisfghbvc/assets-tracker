# Capability: Cloud Synchronization

## ADDED Requirements
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
