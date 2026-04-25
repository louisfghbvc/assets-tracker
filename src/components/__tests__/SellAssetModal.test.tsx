import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SellAssetModal from '../SellAssetModal';

vi.mock('../../services/portfolio', () => ({
    sellAsset: vi.fn(),
    ValidationError: class ValidationError extends Error {
        constructor(msg: string) { super(msg); this.name = 'ValidationError'; }
    },
}));

import { sellAsset } from '../../services/portfolio';

const baseTWAsset = {
    id: 1,
    recordId: 'r1',
    symbol: '2330',
    name: '台積電',
    type: 'stock' as const,
    market: 'TW' as const,
    quantity: 100,
    cost: 800,
    currentPrice: 950,
    lastUpdated: Date.now(),
    source: 'manual' as const,
};

const baseUSAsset = {
    ...baseTWAsset,
    id: 2,
    recordId: 'r2',
    symbol: 'AAPL',
    name: 'Apple Inc',
    market: 'US' as const,
    cost: 150,
    currentPrice: 200,
};

const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    asset: baseTWAsset,
    currentExchangeRate: 32,
    onSold: vi.fn(),
    language: 'en' as const,
};

describe('SellAssetModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('does not render when isOpen is false', () => {
        const { container } = render(<SellAssetModal {...defaultProps} isOpen={false} />);
        expect(container.firstChild).toBeNull();
    });

    it('does not render when asset is null', () => {
        const { container } = render(<SellAssetModal {...defaultProps} asset={null} />);
        expect(container.firstChild).toBeNull();
    });

    it('renders TW asset with held quantity and EN labels', () => {
        render(<SellAssetModal {...defaultProps} />);
        expect(screen.getByText(/2330/)).toBeInTheDocument();
        expect(screen.getByText('100')).toBeInTheDocument(); // held quantity
        expect(screen.getByText(/Sell Quantity/i)).toBeInTheDocument();
        expect(screen.getByText(/Sell Price/i)).toBeInTheDocument();
        expect(screen.getByText(/Sell Date/i)).toBeInTheDocument();
        expect(screen.getByText(/Fees/i)).toBeInTheDocument();
    });

    it('renders correct labels in ZH mode', () => {
        render(<SellAssetModal {...defaultProps} language="zh" />);
        expect(screen.getByText(/賣出數量/)).toBeInTheDocument();
        expect(screen.getByText(/賣出價格/)).toBeInTheDocument();
    });

    it('confirm button is disabled when qty is empty', () => {
        render(<SellAssetModal {...defaultProps} />);
        const btn = screen.getByRole('button', { name: /Confirm Sell/i });
        expect(btn).toBeDisabled();
    });

    it('confirm button enables when qty and price are filled', () => {
        render(<SellAssetModal {...defaultProps} />);
        fireEvent.change(screen.getByPlaceholderText(/Max 100/i), { target: { value: '10' } });
        const btn = screen.getByRole('button', { name: /Confirm Sell/i });
        expect(btn).not.toBeDisabled();
    });

    it('shows error when qty exceeds holdings', async () => {
        render(<SellAssetModal {...defaultProps} />);
        fireEvent.change(screen.getByPlaceholderText(/Max 100/i), { target: { value: '999' } });
        fireEvent.click(screen.getByRole('button', { name: /Confirm Sell/i }));
        await waitFor(() => {
            expect(screen.getByText(/Quantity exceeds holdings/i)).toBeInTheDocument();
        });
        expect(sellAsset).not.toHaveBeenCalled();
    });

    it('shows error when sell price is invalid (negative)', async () => {
        render(<SellAssetModal {...defaultProps} />);
        fireEvent.change(screen.getByPlaceholderText(/Max 100/i), { target: { value: '5' } });
        // Override the pre-filled price with an invalid negative value
        const priceInput = screen.getByPlaceholderText(/Price per unit/i);
        fireEvent.change(priceInput, { target: { value: '-10' } });
        fireEvent.click(screen.getByRole('button', { name: /Confirm Sell/i }));
        await waitFor(() => {
            expect(screen.getByText(/valid sell price/i)).toBeInTheDocument();
        });
        expect(sellAsset).not.toHaveBeenCalled();
    });

    it('calls sellAsset and onSold on successful submit', async () => {
        vi.mocked(sellAsset).mockResolvedValue({} as any);
        render(<SellAssetModal {...defaultProps} />);
        fireEvent.change(screen.getByPlaceholderText(/Max 100/i), { target: { value: '10' } });
        fireEvent.click(screen.getByRole('button', { name: /Confirm Sell/i }));
        await waitFor(() => {
            expect(sellAsset).toHaveBeenCalledWith(expect.objectContaining({
                assetId: 1,
                soldQuantity: 10,
                sellPrice: 950,
            }));
            expect(defaultProps.onSold).toHaveBeenCalled();
            expect(defaultProps.onClose).toHaveBeenCalled();
        });
    });

    it('shows TWD approx for US asset when qty and price are filled', () => {
        render(<SellAssetModal {...defaultProps} asset={baseUSAsset} />);
        fireEvent.change(screen.getByPlaceholderText(/Max 100/i), { target: { value: '5' } });
        // price is pre-filled from currentPrice=200, gain = (200-150)*5 = 250 USD => 8000 TWD
        expect(screen.getByText(/TWD/)).toBeInTheDocument();
    });

    it('passes exchangeRateAtSale for US asset', async () => {
        vi.mocked(sellAsset).mockResolvedValue({} as any);
        render(<SellAssetModal {...defaultProps} asset={baseUSAsset} />);
        fireEvent.change(screen.getByPlaceholderText(/Max 100/i), { target: { value: '5' } });
        fireEvent.click(screen.getByRole('button', { name: /Confirm Sell/i }));
        await waitFor(() => {
            expect(sellAsset).toHaveBeenCalledWith(expect.objectContaining({
                exchangeRateAtSale: 32,
            }));
        });
    });

    it('passes exchangeRateAtSale as undefined for TW asset', async () => {
        vi.mocked(sellAsset).mockResolvedValue({} as any);
        render(<SellAssetModal {...defaultProps} asset={baseTWAsset} />);
        fireEvent.change(screen.getByPlaceholderText(/Max 100/i), { target: { value: '5' } });
        fireEvent.click(screen.getByRole('button', { name: /Confirm Sell/i }));
        await waitFor(() => {
            expect(sellAsset).toHaveBeenCalledWith(expect.objectContaining({
                exchangeRateAtSale: undefined,
            }));
        });
    });

    it('sellDate submitted is local midnight (not UTC midnight)', async () => {
        vi.mocked(sellAsset).mockResolvedValue({} as any);
        render(<SellAssetModal {...defaultProps} />);
        const dateInput = screen.getByDisplayValue(/^\d{4}-\d{2}-\d{2}$/);
        fireEvent.change(dateInput, { target: { value: '2024-03-15' } });
        fireEvent.change(screen.getByPlaceholderText(/Max 100/i), { target: { value: '5' } });
        fireEvent.click(screen.getByRole('button', { name: /Confirm Sell/i }));
        await waitFor(() => {
            const call = vi.mocked(sellAsset).mock.calls[0][0];
            const sellDate = call.sellDate as number;
            const d = new Date(sellDate);
            // Local midnight: hours, minutes, seconds should all be 0 in local time
            expect(d.getHours()).toBe(0);
            expect(d.getMinutes()).toBe(0);
            expect(d.getSeconds()).toBe(0);
            // The local date should be 2024-03-15
            expect(d.getFullYear()).toBe(2024);
            expect(d.getMonth()).toBe(2); // 0-indexed
            expect(d.getDate()).toBe(15);
        });
    });

    it('today default sell date is in local timezone (YYYY-MM-DD format)', () => {
        render(<SellAssetModal {...defaultProps} />);
        const dateInput = screen.getByDisplayValue(/^\d{4}-\d{2}-\d{2}$/);
        const value = (dateInput as HTMLInputElement).value;
        // Must be a valid YYYY-MM-DD string matching today in local time
        const localToday = new Date().toLocaleDateString('sv');
        expect(value).toBe(localToday);
    });
});
