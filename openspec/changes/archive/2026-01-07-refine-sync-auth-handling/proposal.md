# Proposal: Refine Sync Auth Error Handling

## Why
1. **Misleading Error Messages**: When a Google OAuth token expires, the system previously reported it as a "Drive API Error", leading users to think their permissions were misconfigured.
2. **Session Persistence**: The app needs to gracefully handle expired sessions by redirecting users to the login screen instead of showing cryptic errors.

## What Changes
1. **Precision 401 Handling**: Update `googleSheetsService` to explicitly check for `401 Unauthorized` status on all API calls (search, metadata, spreadsheet creation, value updates).
2. **Unified Session Expiry**: Ensure that any `UNAUTHORIZED` error triggers a `handleLogout()` and displays the `sessionExpired` translation.

## Design
- Catch `response.status === 401` in all `fetch` calls to Google APIs.
- Throw a specific `"UNAUTHORIZED"` string error.
- Intercept this error in the UI layer (`App.tsx`) to trigger logout.
