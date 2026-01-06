# Proposal: Show Exchange Balances in UI

The user wants to clearly see how much balance is synced from Pionex/BitoPro and identify the source of individual asset records.

## Why
Currently, synced assets are mixed into the general list. While they have small codes ('P', 'B'), it is not immediately clear what these mean, and there is no way to see the total value currently held in a specific exchange link.

## What Changes
### UI Enhancements
1. **Exchange Value in Settings**: Display the total estimated value (converted to TWD) for each exchange connection in the Settings tab.
2. **Source Labels in Expanded Assets**: Add a "Source" field (e.g., "Pionex", "BitoPro", "Manual") to the individual record entries when an asset card is expanded.
3. **Tooltip for Source Badges**: Add tooltips to the 'P' and 'B' badges in the asset list to explain their meaning.

### Code
- [MODIFY] [App.tsx](file:///Users/louisfghbvc/Coding/assets-tracker/src/App.tsx)
    - Add `exchangeTotals` useMemo calculation.
    - Update `exchange-config-card` rendering.
    - Update `record-item` rendering in expanded state.

## Impact
- Improved visibility and accountability for synced data.
- Better user understanding of the hybrid asset tracking system.
