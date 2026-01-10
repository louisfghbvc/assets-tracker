# Design: Fix Exchange Asset Duplication

## 1. Localization & Normalization
Update `exchangeService.syncBalances` to normalize the `exchangeName` to lowercase:
```typescript
const sourceName = exchangeName.toLowerCase();
// Use sourceName for all db.assets.where('source').equals(sourceName) calls
```

## 2. Aggregation Logic
In `fetchPionex` and `fetchBitoPro`, instead of returning a mapped array directly, use a map to aggregate totals:

```typescript
const balanceMap = new Map<string, { quantity: number, ... }>();
// ... iterate API response
const existing = balanceMap.get(symbol);
if (existing) {
    existing.quantity += amount;
} else {
    balanceMap.set(symbol, { ... });
}
return Array.from(balanceMap.values());
```

## 3. Stable Record ID
Instead of `bitopro-BTC-173655...`, use `bitopro-btc`. This makes the data more predictable and reduces the impact of failed deletions.

## 4. Database Migration (Optional but recommended)
Ensure all existing `source` values are lowercase.
