# Proposal: Add Total Cost Display to Asset Details

## Problem
Users currently see current market value and average cost, but they lack a quick way to see the "Total Cost" (the total amount invested) for a specific asset group without manual calculation. 

## Proposed Solution
Add a "Total Cost" field to the expanded detail section of each asset card.
1.  **UI Update**: In the `asset-details-expanded` section, add a new `summary-stat` entry for "Total Cost".
2.  **Logic**: Utilize the existing `totalCostBasis` property calculated in the `mergedAssets` useMemo hook.
3.  **Localization**: Add `totalCost` translations for both English and Chinese.

## Goals
- Allow users to see their total investment amount per asset.
- Maintain a clean UI by placing this secondary information in the expanded view.
