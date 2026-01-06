# Proposal: Fix GitHub Pages White Screen

## Problem
The AssetTracker application displays a white screen when deployed to GitHub Pages. This is due to incorrect asset path resolution.

## Analysis
- **Absolute Paths**: `index.html` uses absolute paths (e.g., `/src/main.tsx`) which fail when the app is hosted in a subdirectory like `/assets-tracker/`.
- **Missing Base URL**: `vite.config.ts` does not define a `base` path, defaulting to `/`, which is incorrect for project-page deployments.

## Proposed Solution
1. Update `vite.config.ts` to set `base: './'` for universal relative path resolution or `/assets-tracker/` for targeted GH Pages support.
2. Update `index.html` to use relative paths for the entry script and icons.
3. Configure `package.json` with the `homepage` field to assist build tools.

## Expected Outcome
The application will correctly resolve all static assets (JS, CSS, Icons) when loaded from `https://louisfghbvc.github.io/assets-tracker/`, eliminating the white screen.
