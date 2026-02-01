# Tasks: Implement Comprehensive Testing

## Infrastructure Setup
- [x] Install testing dependencies: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, `fake-indexeddb`.
- [x] Configure `vitest.config.ts` or extend `vite.config.ts`.
- [x] Add `test` script to `package.json`.
- [x] Create a `src/test-setup.ts` to configure global mocks (e.g., Tauri, ResizeObserver, localStorage, IndexedDB).

## Service Layer Tests
- [x] Implement unit tests for `src/services/search.ts`.
- [x] Implement unit tests for `src/services/price.ts` (mocking fetch).
- [x] Implement unit tests for `src/services/exchange.ts`.
- [x] Implement unit tests for `src/services/sync.ts` (data merging logic).
- [x] Implement unit tests for `src/services/googleSheets.ts` (auth and request mapping).

## Data Access Layer Tests
- [x] Implement integration tests for `src/db/database.ts` using an in-memory Dexie instance.

## Component Tests
- [x] Implement tests for `src/components/AddAssetModal.tsx` (validation and submission).
- [x] Implement tests for `src/components/EditAssetModal.tsx` (field persistence and read-only sync fields).
- [x] Implement tests for `src/components/PriceChart.tsx` (rendering data points).
- [x] Implement tests for `App.tsx` global states (Privacy Mode, Language, Login).

## Finalization
- [x] Ensure all tests pass in CI/CD environment (simulated via local run).
- [x] Document how to add new tests in `README.md`.
