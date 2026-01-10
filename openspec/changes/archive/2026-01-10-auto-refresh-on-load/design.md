# Design: Auto-Refresh on Application Startup

## Technical Implementation

### 1. State Addition
Add a state variable to track if the initial refresh has been performed:
```tsx
const [hasInitialRefreshed, setHasInitialRefreshed] = useState(false);
```

### 2. Auto-Refresh Logic
Add a `useEffect` hook that watches for `accessToken`. Once `accessToken` is available and `hasInitialRefreshed` is false, it calls `handleRefresh`.

### 3. Handling API Rate Limits
Since `handleRefresh` involves multiple API calls (Exchanges + Prices), triggering it only once on startup is acceptable. If the app is opened multiple times (e.g., browser refresh), it will trigger again, which is the expected behavior.

## Workflow Integration
- The token recovery logic in existing `useEffect` will set the `accessToken`.
- The new `useEffect` will detect this and trigger `handleRefresh`.
- If the user logs in for the first time, the `onSuccess` callback sets the `accessToken`, also triggering the refresh.
