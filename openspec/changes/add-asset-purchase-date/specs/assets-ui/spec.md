## MODIFIED Requirements

### Requirement: Asset Detail Editing
The system SHALL allow users to modify the properties of existing assets to correct errors or update cost basis and purchase timing information.

#### Scenario: Editing Manual Asset
- **GIVEN** a manual asset record
- **WHEN** the user edits the record
- **THEN** they MUST be able to update quantity, cost, name, and purchase date.

#### Scenario: Editing Synced Asset Cost
- **GIVEN** an asset synced from Pionex or BitoPro
- **WHEN** the user edits the record
- **THEN** they MUST be able to update the cost basis and purchase date.
- **AND** the quantity MUST remain read-only as it is source-dependent.
- **AND** the updated cost and purchase date MUST persist across exchange synchronizations.

#### Scenario: Purchase Date Input Display
- **GIVEN** any asset (manual or synced)
- **WHEN** the edit modal is open
- **THEN** a date-time input labeled with the purchase date field MUST be visible and editable.
