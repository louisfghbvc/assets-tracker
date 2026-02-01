import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';

// Mock IndexedDB
globalThis.indexedDB = indexedDB;
globalThis.IDBKeyRange = IDBKeyRange;

// Mock Tauri APIs
vi.mock('@tauri-apps/api', () => ({
    invoke: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-opener', () => ({
    revealItemInDir: vi.fn(),
}));

// Mock ResizeObserver for Recharts
globalThis.ResizeObserver = class ResizeObserver {
    observe() { }
    unobserve() { }
    disconnect() { }
};

// Mock localStorage
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => { store[key] = value.toString(); },
        clear: () => { store = {}; },
        removeItem: (key: string) => { delete store[key]; },
    };
})();
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });
