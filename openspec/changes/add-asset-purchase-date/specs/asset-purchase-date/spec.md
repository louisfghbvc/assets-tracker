## ADDED Requirements

### Requirement: Asset Purchase Date Storage
The system SHALL store a `purchaseDate` timestamp (Unix ms) on each asset record representing when the asset was purchased.

#### Scenario: New asset default purchase date
- **WHEN** a new asset is added without specifying a purchase date
- **THEN** the system SHALL set `purchaseDate` to the current time

#### Scenario: Existing assets migration
- **WHEN** the database upgrades to the new schema version
- **THEN** the system SHALL set `purchaseDate` to `lastUpdated` for all existing assets that lack a `purchaseDate`

### Requirement: Purchase Date Editing
The system SHALL allow users to edit the purchase date of any asset, including synced assets from exchanges.

#### Scenario: User edits purchase date on manual asset
- **WHEN** the user opens the Edit Asset modal for a manual asset
- **THEN** a date-time input MUST be displayed showing the current `purchaseDate`
- **AND** the user MUST be able to change it to any valid date and time

#### Scenario: User edits purchase date on synced asset
- **WHEN** the user opens the Edit Asset modal for a Pionex or BitoPro synced asset
- **THEN** the purchase date input MUST be editable (not read-only)
- **AND** saving MUST persist the chosen date independently of exchange sync

#### Scenario: Saving purchase date
- **WHEN** the user submits the edit form with a valid purchase date
- **THEN** the system MUST store the new `purchaseDate` as a Unix ms timestamp
- **AND** the updated date MUST be immediately reflected in the asset card view

### Requirement: Purchase Date Display
The system SHALL display the purchase date in the expanded asset card in a human-readable format.

#### Scenario: Displaying a known purchase date
- **WHEN** an asset has a `purchaseDate` value
- **THEN** the expanded asset card MUST show it formatted as a localized date string (e.g., "2024/01/15")

#### Scenario: Displaying when purchase date is absent
- **WHEN** an asset has no `purchaseDate` value
- **THEN** the expanded asset card MUST display "—" in place of the date
