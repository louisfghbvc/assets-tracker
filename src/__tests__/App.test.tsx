import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from '../App';

import { useLiveQuery } from 'dexie-react-hooks';

// Mock DB hooks
vi.mock('dexie-react-hooks', () => ({
    useLiveQuery: vi.fn(),
}));

// Mock Google Login
vi.mock('@react-oauth/google', () => ({
    useGoogleLogin: vi.fn(() => vi.fn()),
    GoogleOAuthProvider: ({ children }: any) => <div>{children}</div>,
}));

// Mock services
vi.mock('./services/sync', () => ({
    syncService: { upload: vi.fn(), download: vi.fn() },
}));
vi.mock('./services/price', () => ({
    priceService: { fetchPrices: vi.fn().mockResolvedValue([]), fetchExchangeRate: vi.fn().mockResolvedValue(32.5) },
}));

describe('App', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    it('should render login screen if no access token', () => {
        render(<App />);
        expect(screen.getByText('AssetTracker')).toBeInTheDocument();
        expect(screen.getByText('使用 Google 登入')).toBeInTheDocument();
    });

    it('should render assets from database', () => {
        localStorage.setItem('google_access_token', 'fake-token');
        const mockAssets = [
            { id: 1, symbol: 'AAPL', name: 'Apple', market: 'US', quantity: 10, currentPrice: 150, cost: 140, type: 'stock', source: 'manual' }
        ];
        vi.mocked(useLiveQuery).mockReturnValue(mockAssets);

        render(<App />);
        expect(screen.getByText('Apple')).toBeInTheDocument();
        expect(screen.getByText('AAPL')).toBeInTheDocument();
    });

    it('should toggle Privacy Mode and mask values', () => {
        localStorage.setItem('google_access_token', 'fake-token');
        const mockAssets = [
            { id: 1, symbol: 'AAPL', name: 'Apple', market: 'US', quantity: 10, currentPrice: 150, cost: 140, type: 'stock', source: 'manual' }
        ];
        vi.mocked(useLiveQuery).mockReturnValue(mockAssets);

        render(<App />);

        const balance = screen.getByTestId('total-balance');
        expect(balance.textContent).toContain('$');
        expect(balance.textContent).not.toBe('****');

        const toggle = screen.getByTestId('privacy-toggle');
        fireEvent.click(toggle);

        expect(balance.textContent).toBe('****');
    });

    it('should toggle language between ZH and EN', () => {
        localStorage.setItem('google_access_token', 'fake-token');
        vi.mocked(useLiveQuery).mockReturnValue([]);
        render(<App />);

        // Default is ZH
        expect(screen.getByText('資產清單')).toBeInTheDocument();

        // The language button text is '中文' when in ZH mode
        const langBtn = screen.getByText('中文');
        fireEvent.click(langBtn);

        // Should switch to EN
        expect(screen.getByText('Assets')).toBeInTheDocument();
        expect(screen.getByText('EN')).toBeInTheDocument();
    });

    it('should switch between tabs', () => {
        localStorage.setItem('google_access_token', 'fake-token');
        vi.mocked(useLiveQuery).mockReturnValue([]);
        render(<App />);

        // Initially on Assets tab
        expect(screen.getByText('資產清單')).toBeInTheDocument();

        // Click Stats tab
        const statsTab = screen.getByText('數據分析');
        fireEvent.click(statsTab);

        // Check for stats content
        expect(screen.getByText('資產配置圖表')).toBeInTheDocument();
    });
});
