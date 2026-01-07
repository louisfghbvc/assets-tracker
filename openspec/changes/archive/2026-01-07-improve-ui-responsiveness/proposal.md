# Proposal: Improve UI Responsiveness and Layout Consistency

## Why
1. **Device Diversity**: Users access the app on various devices ranging from small-screen phones (e.g., iPhone SE) to large-screen phones and tablets.
2. **Layout Breakpoints**: Current media queries handle basic mobile/desktop transitions but lack fine-tuned adjustments for the extreme diversity of mobile screen widths.
3. **Typography Scaling**: Large financial values (e.g., total balance) can overflow or look disproportionate on different screen sizes if fixed font sizes are used.
4. **Interactive Safety**: Touch targets and modal heights need to adapt to different aspect ratios to ensure usability (e.g., ensuring submit buttons aren't hidden behind keyboard or off-screen on short devices).

## What Changes
1. **Fluid Typography**: Transition key UI elements (like the main balance display) to use CSS `clamp()` for fluid scaling between screen sizes.
2. **Enhanced Breakpoints**: Refine CSS media queries to include a "compact" breakpoint for devices below 360px width.
3. **Flexible Components**: Update asset cards and list items to use more robust flex/grid layouts that handle long symbol names and large amounts without overlapping.
4. **Scrolling Modal UX**: Ensure all modals implement vertical scrolling for the form content area, preventing overflow on small screens or landscape orientation.
5. **Standardized Padding/Gaps**: Move towards using relative units (rem/em) or CSS variables for layout spacing to ensure consistent proportions.

## Design
- **Fluid Scale**: Main balance will scale between 2.2rem and 3.8rem based on viewport width.
- **Card Adaptive Layout**: Asset items will shift from a horizontal spread to a more stacked orientation on extremely narrow screens to preserve readability.
- **Viewport-Aware Modals**: Modals will use `max-height: 90vh` with an internal scroll area for the form body.
