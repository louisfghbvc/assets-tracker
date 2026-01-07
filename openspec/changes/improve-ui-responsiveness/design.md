# Design: UI Responsiveness and Layout Consistency

## Fluid Typography
The main balance display is the focal point of the app. Using fixed `px` or `rem` sizes leads to it being too small on large phones and too large on small phones.
- **Implementation**: Use `font-size: clamp(2.2rem, 8vw + 1rem, 3.8rem);`
- **Result**: The text will naturally grow/shrink with the screen while staying within safe bounds.

## Adaptive Asset Cards
On screens under 360px, the current horizontal layout (Icon | Info | Price | Actions) becomes crowded.
- **Strategy**: 
  - Use `flex-wrap: wrap` on the `asset-summary`.
  - On narrow screens, the `asset-market` (price info) should stay aligned but allow the `asset-info` (name/symbol) to occupy more space.
  - Ensure `min-width: 0` on flex children to permit ellipsis truncation of long names.

## Modal Viewport Management
Currently, if a phone is in landscape or has a very small screen, the "Add Asset" or "Edit Asset" buttons can be cut off.
- **Strategy**: 
  - `.modal-content` should have `max-height: 90vh`.
  - `.asset-form` (the scrollable area) should have `overflow-y: auto`.
  - The `modal-header` and `submit-btn` should remain fixed/visible if possible, or part of a single scrollable container if height is extremely limited.

## CSS Variables for Scaling
Introduce standardized spacing variables in `App.css`:
- `--spacing-base: clamp(12px, 2vw, 24px);`
- Use this variable for padding and gaps in the `app-container` and `stats-grid`.
