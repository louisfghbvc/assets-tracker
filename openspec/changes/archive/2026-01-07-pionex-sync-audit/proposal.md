# Proposal: Pionex Sync Audit & Diagnostics

The user reported that some Pionex assets (specifically those held in bots or investment accounts) are not appearing in their portfolio.

## Why
Pionex's official API `/api/v1/account/balances` is documented to only include balances from the **Trading Account** (Manual trading). Assets held in **Trading Bots** (Grid trading bots, etc.) and **Earn Accounts** (Staking, Structured products) are intentionally excluded by the Pionex API itself.

## What Changes
1. **Developer Tooling**: Add a diagnostic log in `exchangeService.syncBalances` that logs the raw number of coins fetched from Pionex to the console (already exists but can be improved).
2. **UI Clarification**: Update the "Tip" in the Settings tab to explicitly mention that Pionex/BitoPro sync currently only captures the basic trading account balances.
3. **Bot Support Investigation**: Research if `GET /api/v1/trade/grids` or other non-documented endpoints can be used to aggregate bot balances (though current research suggests these are not publicly available).

## Impact
- No immediate code change to the fetching logic as the limitation is on the API provider side.
- Improved user transparency regarding what data is being synced.
