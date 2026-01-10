# exchange-integration Specification

## ADDED Requirements

### Requirement: Automated Exchange Sync
The system SHALL synchronize asset quantities from supported exchanges (Pionex, BitoPro).

#### Scenario: Aggregated Balance Update
- **GIVEN** an exchange API returns multiple balance entries for the same currency (e.g. Spot and Grid)
- **WHEN** the sync is performed
- **THEN** the system MUST sum these quantities.
- **AND** create exactly ONE database record for that currency per exchange.

#### Scenario: Idempotent Sync
- **GIVEN** existing assets synced from an exchange
- **WHEN** a new sync is performed
- **THEN** it MUST completely replace old records from that exchange without creating duplicates.
- **AND** normalization MUST be applied to prevent casing mismatches (e.g., 'bitopro' vs 'BitoPro').
