# Design: Fix Crypto Price Flicker

## Current Logic (Simplified)
```typescript
async function handleRefresh() {
  const assets = await db.assets.toArray();
  const prices = await priceService.fetchPrices(assets.symbols);
  await db.updatePrices(prices); // UI UPDATES HERE (Prices OK)
  
  await syncExchanges(); // DELETES AND RE-ADDS ASSETS
  // UI UPDATES HERE (Prices LOST, show 0)
}
```

## Improved Logic
```typescript
async function handleRefresh() {
  // 1. Sync Balances (Structural change)
  await syncExchanges(); 
  
  // 2. Refresh Prices (Content change)
  const assets = await db.assets.toArray();
  const prices = await priceService.fetchPrices(assets.symbols);
  await db.updatePrices(prices);
}
```

## Implementation Details
1. Move the exchange sync loop to the beginning of the `try` block in `handleRefresh`.
2. Ensure `fetchExchangeRate` is called early.
3. Repopulate `allAssets` and `uniqueSymbols` *after* the exchange sync is complete.

## Edge Cases
- **Exchange Sync Fails**: If one exchange fails, we should still proceed to update prices for the rest of the assets.
- **No Assets**: Handle empty cases gracefully.
