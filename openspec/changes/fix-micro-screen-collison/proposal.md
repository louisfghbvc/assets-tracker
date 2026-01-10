# Proposal: Fix UI Collisions on Micro-Screens

## Why
1. **Colliding Elements**: On very narrow screens (e.g., iPhone SE or similar), the 3-column stats grid and horizontal asset summaries cause text and icons to overlap.
2. **Visual Clutter**: Large currency values combined with action buttons (delete/expand) fight for limited horizontal space, leading to poor readability as seen in user screenshots.

## What Changes
1. **Stats Grid Adaptability**: Transition from 3 columns to 2 columns (or 1 column) on screens below 360px to prevent value overlap.
2. **Asset SummaryWrapping**: Refine the `.asset-summary` wrapping logic. Instead of just wrapping, we should ensure the "Market/Price" info and "Actions" stay legible, potentially shifting to a stacked layout for micro-screens.
3. **Typography Refinement**: Shrink secondary text (symbols, units) even further on tiny screens to prioritize primary values (asset name, total price).
4. **Spacing Tuning**: Reduce horizontal padding in `.app-container` slightly more for micro-screens to gain back precious pixels.

## Design
- **Stats Grid**: Use `grid-template-columns: repeat(auto-fit, minmax(100px, 1fr))` or a specific media query for 2-columns on micro-screens.
- **Asset Item**: On `< 350px`, the `asset-market` and `asset-actions` should occupy their own "row" area within the flex container or use a more defensive flex-basis.
- **Action Buttons**: Slightly reduce the size of the chevron and delete buttons on extreme small screens.
