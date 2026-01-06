# Proposal: Fix Exchange Connection Icons

The user reported that the buttons in the "Exchange Connections" section appear as empty boxes with a blue glow, but no icons are visible.

## Why
The global `button` style in `index.css` adds significant padding (`0.6em 1.2em`) and a large box-shadow. For small buttons (e.g., `40x40px` used for sync and delete), this padding squashes the usable content area, making the icons (Refresh and Trash) invisible or incorrectly rendered.

## What Changes
- Set `padding: 0` for `.inline-sync-btn` and `.inline-delete-btn` to allow icons to center correctly.
- Refine button base styles in `App.css` to ensure consistent appearance.
- Adjust button hover states to be more subtle if needed.

## Impact
- Affected files: `src/App.css`
- Improved visibility of exchange management actions.
