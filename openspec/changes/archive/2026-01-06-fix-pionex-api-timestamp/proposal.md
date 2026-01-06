# Proposal: Fix Pionex API Timestamp Error

The user is experiencing a "no timestamp in uri args" error when syncing balances from Pionex. This is due to the Pionex API requiring the `timestamp` parameter to be present in the request's query string for all private GET requests.

## Why
Currently, the `exchangeService.fetchPionex` method:
1. Only includes the `timestamp` in the HTTP headers.
2. Constructs the signature message using `METHOD + PATH + TIMESTAMP` without query parameters.
3. Sends the GET request without a query string.

The Pionex API requires:
1. `timestamp` in the query string (e.g., `?timestamp=...`).
2. Signature calculated on `METHOD + PATH_WITH_QUERY`.

## What Changes
- Modify `fetchPionex` in `src/services/exchange.ts` to:
    - Append `?timestamp=${timestamp}` to the URL.
    - Update the signature message to `GET${path}?timestamp=${timestamp}`.
    - Remove the redundant `timestamp` header (optional, but keep for compatibility if needed).

## Impact
- Affected files: `src/services/exchange.ts`
- Fixes the sync failure for Pionex accounts.
