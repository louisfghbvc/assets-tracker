# Proposal: Fix Profit Display Layout Issues

## Problem
Adding absolute profit values to the `stats-card` and `asset-item` has caused layout collisions on mobile and medium-sized screens. The extra text makes the badges too wide, causing them to overlap with labels or push elements out of their containers.

## Proposed Solution
- Adjust `stats-card` layout to stack elements vertically when space is tight.
- Refine the display logic for absolute profit in `stats-card` (e.g., using simpler formatting like `+$1.2k` instead of full digits).
- Update CSS for `stat-card-header` to handle overflow or use vertical stacking on smaller screens.
- Ensure `asset-profit-badge` doesn't overflow its container in the asset list.

## Goals
- Restore a clean, readable UI on all screen sizes.
- Maintain the visibility of both absolute profit and percentage.
