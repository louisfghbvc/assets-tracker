# service-tests Specification

## Purpose
Ensure that all business logic and external integrations (Price, Exchange, Sync, Search) are correctly implemented and handle edge cases gracefully.

## ADDED Requirements

### Requirement: Price Fetching Accuracy
The Price service SHALL be tested to ensure it correctly parses responses from various providers (Binance, Pionex, Taiwan Stock).

#### Scenario: Successful Price Fetch
- **GIVEN** a mocked Binance API response for "BTC"
- **WHEN** `fetchPrice("BTC")` is called
- **THEN** it should return the correct numeric value.

### Requirement: Cloud Sync Reliability
The Sync service SHALL be tested for correct data transformation and de-duplication during upload and download.

#### Scenario: De-duplication on Sync
- **GIVEN** local records and cloud records with overlapping IDs
- **WHEN** a restore is triggered
- **THEN** the system should correctly merge or replace records without duplication.

### Requirement: Fuzzy Search Precision
The Search service SHALL be tested to ensure `fuse.js` is correctly configured for asset lookups.

#### Scenario: Search for Symbol
- **GIVEN** an asset list containing "Bitcoin" and "Ethereum"
- **WHEN** searching for "bit"
- **THEN** "Bitcoin" should be the top result.
