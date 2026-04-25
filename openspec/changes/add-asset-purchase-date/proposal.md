## Why

Users want to track *when* they bought an asset, not just what they paid. Without a purchase date, it's impossible to calculate holding periods, review historical timing decisions, or display time-weighted performance. The field is missing from the data model entirely today.

## What Changes

- Add a `purchaseDate` field (timestamp) to the `Asset` database schema
- Expose a date/time picker in the Edit Asset modal so users can set or update the purchase date
- Display the purchase date in the expanded asset card view
- Run a database version bump; existing assets' `purchaseDate` remains `undefined` (they show "—" until the user fills it in — using `lastUpdated` as a default would be wrong since it is overwritten by price refreshes)

## Capabilities

### New Capabilities
- `asset-purchase-date`: Stores, edits, and displays the purchase date/time for each asset record

### Modified Capabilities
- `assets-ui`: The asset edit form and expanded card view gain a purchase date field

## Impact

- **Database**: `Asset` interface and Dexie schema gain a `purchaseDate: number` (Unix ms timestamp); new version migration required
- **EditAssetModal**: Add date-time input bound to `purchaseDate`
- **Asset card display**: Show formatted purchase date in expanded view
- **No API changes**: purely local data, no backend impact
- **Sync sources** (Pionex, BitoPro): `purchaseDate` will be editable even for synced assets since exchanges don't provide this data
