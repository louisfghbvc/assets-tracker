# price-consistency Specification Delta

## ADDED Requirements

### Requirement: Atomic Balance and Price Sync
The system SHALL ensure that after a full refresh, all assets (including those synced from external exchanges) display current market prices immediately, without a period of time showing $0.

#### Scenario: Refreshing Exchange Data
- **GIVEN** the user has Pionex assets connected
- **WHEN** the user clicks the "Refresh" button
- **THEN** the system MUST sync quantities and then update prices before the final UI update.
- **AND** the prices for Pionex assets MUST NOT be reset to $0 in the final view.
