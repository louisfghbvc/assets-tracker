# settings-ui Specification

## Purpose
TBD - created by archiving change fix-exchange-connection-icons. Update Purpose after archive.
## Requirements
### Requirement: Exchange Connection Management
The system SHALL provide a clear list of linked exchanges with "Sync" and "Delete" actions.

#### Scenario: Visual Feedback for Actions
- **GIVEN** a linked exchange exists
- **WHEN** the user views the Settings tab
- **THEN** both the "Sync" (Refresh) and "Delete" (Trash) icons MUST be clearly visible and centered within their respective buttons.
- **AND** the buttons should provide a visual hover state.

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

### Requirement: Language Selection
The system MUST support both English and Traditional Chinese localizations.

#### Scenario: Intuitive Language Toggle
- **GIVEN** the user is on any screen
- **WHEN** the language is set to Chinese
- **THEN** the language button MUST display "中文".
- **AND** all UI elements including modals MUST be in Chinese.

#### Scenario: Modal Localization
- **GIVEN** the "Add Asset" or "Edit Asset" modal is open
- **WHEN** the language is switched
- **THEN** all labels, buttons, and placeholders MUST update to the selected language.
- **AND** market names (TW, US, Crypto) MUST be localized.

