# Proposal: Auto-Refresh on Application Startup

## Why
Currently, users must manually click the refresh button to update asset prices and exchange balances when they open the app. Automatically refreshing on startup ensures the data is always up-to-date without user intervention, providing a more seamless experience.

## What Changes
- Implement an automatic data refresh when the application initializes and a valid Google access token is present.
- Use a `useEffect` hook to trigger the existing `handleRefresh` logic.
- Ensure the refresh only occurs once per application session to prevent redundant API calls.

## Goals
- Provide real-time data immediately upon opening the app.
- Reduce manual effort for the user.

## Non-Goals
- Automatic periodic refreshing (e.g., every 5 minutes). This proposal only covers the initial load.
