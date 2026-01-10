# Design: Fix Profit Display Layout Issues

## CSS Adjustments

### 1. Stats Grid & Cards
- Change `.stat-card-header` flex direction to `column` and `align-items: flex-start` on screens below 480px.
- Adjust `.stat-card-pct` padding and font size to be more compact.
- Use `flex-wrap: wrap` where appropriate.

### 2. Asset List
- Ensure `.asset-profit-badge` has enough space or uses a more compact format.
- Adjust `.asset-summary` breakpoints to handle wide profit badges.

## Component Changes (App.tsx)
- For the `stats-card`, implement a "compact" formatter for the absolute profit. Instead of `$64,014.6`, use `$64k` or `$64.0k` to save horizontal space.
- Apply this compact formatting only to the `stats-card` to maintain precision in the expanded asset view if needed.

## Breakpoints
- Add/Update rules for `(max-width: 480px)` and `(max-width: 400px)` in `App.css`.
