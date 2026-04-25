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
    priceService: {
        fetchPrices: vi.fn().mockResolvedValue([]),
        fetchExchangeRate: vi.fn().mockResolvedValue(32.5),
        fetchBenchmarkPrice: vi.fn().mockResolvedValue(null),
    },
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

    it('should render purchaseDate as formatted text in record-purchase-date span', () => {
        localStorage.setItem('google_access_token', 'fake-token');
        const ts = 1700000000000;
        const mockAssets = [
            { id: 1, symbol: 'AAPL', name: 'Apple', market: 'US', quantity: 10, currentPrice: 150, cost: 140, type: 'stock', source: 'manual', purchaseDate: ts }
        ];
        // useLiveQuery is called for assets, history, and sellRecords — return appropriate value per call
        vi.mocked(useLiveQuery).mockImplementation((fn: any) => {
            const key = fn.toString();
            if (key.includes('sellRecords') || key.includes('SellRecord')) return [];
            if (key.includes('history') || key.includes('History')) return [];
            return mockAssets;
        });
        render(<App />);

        // Expand the asset row to reveal individual records
        const assetItem = document.querySelector('.asset-item');
        expect(assetItem).not.toBeNull();
        fireEvent.click(assetItem!);

        const dateSpan = document.querySelector('.record-purchase-date');
        expect(dateSpan).not.toBeNull();
        expect(dateSpan?.textContent).toContain(new Date(ts).toLocaleDateString());
    });

    it('should render — in record-purchase-date span when purchaseDate is absent', () => {
        localStorage.setItem('google_access_token', 'fake-token');
        const mockAssets = [
            { id: 1, symbol: 'AAPL', name: 'Apple', market: 'US', quantity: 10, currentPrice: 150, cost: 140, type: 'stock', source: 'manual' }
        ];
        vi.mocked(useLiveQuery).mockImplementation((fn: any) => {
            const key = fn.toString();
            if (key.includes('sellRecords') || key.includes('SellRecord')) return [];
            if (key.includes('history') || key.includes('History')) return [];
            return mockAssets;
        });
        render(<App />);

        const assetItem = document.querySelector('.asset-item');
        expect(assetItem).not.toBeNull();
        fireEvent.click(assetItem!);

        const dateSpan = document.querySelector('.record-purchase-date');
        expect(dateSpan).not.toBeNull();
        expect(dateSpan?.textContent).toContain('—');
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

    it('should render PerformanceView when performance tab is clicked', () => {
        localStorage.setItem('google_access_token', 'fake-token');
        const mockAssets = [
            { id: 1, symbol: 'AAPL', name: 'Apple', market: 'US', quantity: 10, currentPrice: 150, cost: 140, type: 'stock', source: 'manual', purchaseDate: Date.now() - 400 * 86400000 }
        ];
        vi.mocked(useLiveQuery).mockReturnValue(mockAssets);
        render(<App />);

        const perfTab = screen.getByText('績效');
        fireEvent.click(perfTab);

        // Assert a string unique to PerformanceView (not the tab label)
        expect(screen.getByText('績效總覽')).toBeInTheDocument();
    });
});
