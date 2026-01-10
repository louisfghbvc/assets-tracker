# Design: Micro-Screen UI Collision Fixes

## Stats Grid Optimization
The current `repeat(3, 1fr)` is too rigid. 
- **Change**: Introduce `@media (max-width: 360px) { .stats-grid { grid-template-columns: repeat(2, 1fr); } }`.
- **Reasoning**: This gives each card more width to show the `$XXXX.Xk` values without overflow.

## Asset Card Layout (The "Stack" Strategy)
On micro-screens, horizontal space is the enemy.
- **Change**: Enhance the `350px` media query for `.asset-summary`.
- **Details**:
  - `.asset-summary` -> `flex-wrap: wrap`.
  - `.asset-info` (Name/Symbol) -> `flex: 1 1 100%` (takes full top row).
  - `.asset-market` & `.asset-actions` -> `flex: 0 0 auto` (shares the second row).
  - This prevents the price from colliding with the trash icon because they are no longer necessarily on the same line as the name.

## Typography & Icon Scaling
- **Change**: Slightly reduce `.asset-icon` and `.stat-icon` in the micro-breakpoint.
- **Change**: Use `font-size: 0.8rem` for `.asset-name` and `0.7rem` for `.asset-symbol` when width < 320px.

## Global Padding
- **Change**: `@media (max-width: 320px) { .app-container { padding-left: 8px; padding-right: 8px; } }`.
