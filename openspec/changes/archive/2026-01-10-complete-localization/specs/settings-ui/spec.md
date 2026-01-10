# settings-ui Specification (Localization Update)

## ADDED Requirements

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
