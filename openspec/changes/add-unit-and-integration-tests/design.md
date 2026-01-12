# Design: Testing Infrastructure

## Technology Selection
- **Vitest**: Vite-native testing framework. Fast, compatible with Vite config, and supports ESM.
- **React Testing Library**: For testing React components without relying on implementation details.
- **jsdom**: To simulate a browser environment for component tests.
- **MSW (Mock Service Worker)**: (Optional, but recommended) for mocking API responses from Binance, Pionex, and Google APIs.

## Architecture
- **Unit Tests**: Focus on pure functions in `utils` and individual methods in `services`.
- **Integration Tests**: Focus on the interaction between `services`, `db`, and external API mocks.
- **Component Tests**: Focus on user interactions and state changes in key components (e.g., `AddAssetModal`, `PriceChart`).

## Mocking Strategy
- **Local Storage / Dexie**: Use an in-memory database configuration or mock Dexie for unit tests.
- **Tauri APIs**: Mock `@tauri-apps/api` to ensure tests run in a standard Node/JS environment.
- **External APIs**: Use `vi.mock` or MSW to intercept network requests.

## Directory Structure
Tests will be colocated or placed in a `__tests__` directory near the source files:
- `src/services/__tests__/*.test.ts`
- `src/components/__tests__/*.test.tsx`
- `src/db/__tests__/*.test.ts`
