## Context

The app uses Dexie.js (IndexedDB) for local storage. Assets are a flat table — each row is a single asset position. There is no purchase-date field today. The Edit Asset modal (`EditAssetModal.tsx`) is the primary mutation surface for manual assets. Synced assets (Pionex, BitoPro) lock quantity but allow cost edits; purchase date should be fully editable regardless of source.

## Goals / Non-Goals

**Goals:**
- Add `purchaseDate` (Unix ms timestamp, optional) to the `Asset` schema
- No migration default: leave `purchaseDate` as `undefined` for existing assets (they show "—" until manually set)
- Expose a `<input type="datetime-local">` in EditAssetModal
- Display formatted purchase date in the expanded asset card

**Non-Goals:**
- Multiple purchase lots per asset (the schema stays one row per symbol)
- Import/export of purchase date from exchange APIs
- Retroactive price lookup at purchase date

## Decisions

### 1. Field type: Unix ms timestamp (number)

Alternatives considered: ISO string, Date object.  
Rationale: consistent with `lastUpdated` already in the schema; easy to sort and diff; no timezone serialization edge cases.

### 2. `datetime-local` input in the UI

The browser-native `<input type="datetime-local">` requires a value in `YYYY-MM-DDTHH:MM` format (local time). We convert on read using a timezone-corrected formula: `new Date(ts - new Date(ts).getTimezoneOffset() * 60000).toISOString().slice(0, 16)`. Note: `toISOString()` always returns UTC, so subtracting the UTC offset first shifts the timestamp so the UTC representation matches local time. On write: `new Date(value).getTime()`.

Alternatives: date-only input. Rejected — time matters for intra-day traders.

### 3. Migration default: none (leave `purchaseDate` undefined)

`lastUpdated` was rejected as a migration default because it is overwritten on every price refresh (`App.tsx:473`) and every exchange sync (`exchange.ts:172`). Using it would stamp existing assets with "time of last price check," not purchase time. Existing assets show "—" until the user fills in the date manually. This is honest and avoids permanently wrong data.

### 4. Optional field — no strict requirement

`purchaseDate` is typed `number | undefined`. Display code shows "—" when absent (future-proofing for programmatically inserted records that bypass the UI).

## Risks / Trade-offs

- **Timezone UX**: `datetime-local` values are in the browser's local timezone. Users who travel may see unexpected displayed dates. → Acceptable for a personal finance app; document in UI label if needed.
- **Migration irreversibility**: Setting `purchaseDate = lastUpdated` on upgrade is a best-guess; users who never edited records will see `lastUpdated` as the date. → Show purchase date as editable so users can correct it.

## Migration Plan

1. Bump Dexie schema to version 6
2. `upgrade` callback: iterate all assets, set `purchaseDate = asset.lastUpdated` where `purchaseDate` is undefined
3. No rollback needed — the field is additive and optional
