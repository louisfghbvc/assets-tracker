# component-tests Specification

## Purpose
Validate the user interface components to ensure they render correctly and respond appropriately to user interactions.

## ADDED Requirements

### Requirement: Privacy Mode Visibility
All components displaying sensitive financial data SHALL respect the `privacyMode` state.

#### Scenario: Sensitive Data Hidden
- **GIVEN** `privacyMode` is enabled
- **WHEN** an asset card is rendered
- **THEN** total values should be replaced with placeholders (e.g., "*****").

### Requirement: Asset Addition Validation
The "Add Asset" modal SHALL validate user input before allowing submission.

#### Scenario: Incomplete Form
- **GIVEN** the "Add Asset" modal is open
- **WHEN** the user attempts to submit without a symbol
- **THEN** an error message should be displayed and the form should not close.

### Requirement: Multi-language Support
Components SHALL render translated text based on the current language selection.

#### Scenario: Language Switch
- **GIVEN** the application language is set to "zh"
- **WHEN** the "Add Asset" button is rendered
- **THEN** it should display "新增資產".
