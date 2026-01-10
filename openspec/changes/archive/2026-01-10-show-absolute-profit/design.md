# Design: Show Absolute Profit Display

## Component Changes

### 1. Header (Total Balance Section)
- **Current**: Shows `Total Balance`, `+$Value (Percent%) than yesterday`.
- **Change**: Rename `than yesterday` to `Total Profit` (or equivalent in Chinese).
- **Layout**: Ensure the absolute value and percentage are clearly visible.

### 2. Asset Card
- **Current**: Shows `Total Value (USD/TWD)` and `+Percent%`.
- **Change**: Add the absolute profit value (e.g., `+$500 (+10.5%)`).
- **Logic**: Profit is calculated as `(Current Price - Avg Cost) * Quantity`.
- **Formatting**: Use the existing `displayValue` helper and apply the `positive`/`negative` CSS classes based on the profit sign.

### 3. Localization
- Add `totalProfit` and `currentProfit` keys to `translations.ts`.
- Update `zh` and `en` translations.

## Technical Details
- The logic for calculating profit already exists in the `mergedAssets` useMemo in `App.tsx`.
- We just need to expose the `profit` property in the UI.
- Use `TWD` for Taiwan stocks and `USD` (or converted `TWD`) for others as per current convention.
