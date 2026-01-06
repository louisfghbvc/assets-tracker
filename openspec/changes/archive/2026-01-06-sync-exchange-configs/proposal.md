# Proposal: Sync Exchange Configurations to Google Sheets

The user wants to synchronize exchange API configurations (API Key and API Secret) to Google Sheets alongside their asset portfolio. This allows for a "set up once, sync everywhere" experience across devices.

## Requirements
- Automatically backup `exchangeConfigs` to Google Sheets during a manual cloud sync (Upload).
- Restore `exchangeConfigs` from Google Sheets during a manual cloud sync (Download).
- Use a dedicated sheet/tab in the existing `AssetsTracker_DB` spreadsheet to keep configuration data separate from portfolio data.

## User Review Required
> [!WARNING]
> Storing API keys and secrets in Google Sheets (even if read-only) means they are visible to anyone with access to the spreadsheet.
> [!NOTE]
> This feature is requested specifically to simplify multi-device setup for read-only keys.

## Proposed Changes

### Sync Service
#### [MODIFY] [sync.ts](file:///Users/louisfghbvc/Coding/assets-tracker/src/services/sync.ts)
- Update `upload` to also backup `exchangeConfigs`.
- Update `download` to also restore `exchangeConfigs`.

### Google Sheets Service
#### [MODIFY] [googleSheets.ts](file:///Users/louisfghbvc/Coding/assets-tracker/src/services/googleSheets.ts)
- Add `updateExchanges` and `fetchExchanges` methods.
- Ensure the `ExchangeConfigs` tab exists.

## Verification Plan
### Manual Verification
1. Link an exchange on Device A.
2. Trigger "Back up to cloud".
3. Verify "ExchangeConfigs" tab exists in Google Sheets.
4. Trigger "Restore from cloud" on Device B.
5. Verify exchange is linked and usable on Device B.
