# Proposal: Unify Action Button Styles

The user likes the glassmorphism style of the buttons in the Settings tab (exchange connections) and wants to apply this style to the delete buttons in the main asset list.

## Why
Currently, the delete button in the main asset list (`.delete-item-btn`) uses a solid red background with a heavy shadow, which contrasts significantly with the more modern, subtle glassmorphism style used for exchange action buttons. Unifying these styles improves visual consistency and aligns with the user's aesthetic preference.

## What Changes
- Apply the glassmorphism style (semi-transparent background, glass border, no shadow by default) to `.delete-item-btn` and `.record-delete-btn`.
- Maintain the "confirm mode" functionality but update its styling to be consistent with the new base style.
- Use consistent hover effects (accent color for deletion, primary for sync/refresh).

## Impact
- Affected files: `src/App.css`
- Improved UI consistency and premium feel.
