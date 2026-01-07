# Tasks: Fix Crypto Price Flicker

- [x] Update `App.tsx`: Move exchange sync logic before price update logic in `handleRefresh`. <!-- id: 0 -->
- [x] Update `App.tsx`: Recalculate `uniqueSymbols` and `allAssets` after exchange sync. <!-- id: 1 -->
- [x] Verify: Test refresh behavior to ensure prices persist for exchange-synced assets. <!-- id: 2 -->
