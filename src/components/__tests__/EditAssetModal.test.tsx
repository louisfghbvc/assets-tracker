import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EditAssetModal from '../EditAssetModal';
import { db } from '../../db/database';

vi.mock('../../db/database', () => ({
    db: {
        assets: {
            update: vi.fn().mockResolvedValue(undefined),
        },
    },
}));

describe('EditAssetModal', () => {
    const mockT = vi.fn((key) => key);
    const mockOnClose = vi.fn();
    const mockAsset = {
        id: 1,
        recordId: 'r1',
        symbol: 'AAPL',
        name: 'Apple Inc',
        type: 'stock' as const,
        market: 'US' as const,
        quantity: 10,
        cost: 150,
        lastUpdated: Date.now(),
        source: 'manual' as const
    };

    it('should not render when isOpen is false', () => {
        const { container } = render(
            <EditAssetModal isOpen={false} onClose={mockOnClose} asset={mockAsset} t={mockT as any} />
        );
        expect(container.firstChild).toBeNull();
    });

    it('should render asset details correctly', () => {
        render(
            <EditAssetModal isOpen={true} onClose={mockOnClose} asset={mockAsset} t={mockT as any} />
        );
        expect(screen.getByText(/AAPL/)).toBeInTheDocument();
        expect(screen.getByDisplayValue('Apple Inc')).toBeInTheDocument();
        expect(screen.getByDisplayValue('10')).toBeInTheDocument();
        expect(screen.getByDisplayValue('150')).toBeInTheDocument();
    });

    it('should disable quantity input if source is exchange', () => {
        const syncedAsset = { ...mockAsset, source: 'pionex' as const };
        render(
            <EditAssetModal isOpen={true} onClose={mockOnClose} asset={syncedAsset} t={mockT as any} />
        );
        const qtyInput = screen.getByDisplayValue('10');
        expect(qtyInput).toBeDisabled();
    });

    it('should call onClose when close button is clicked', () => {
        render(
            <EditAssetModal isOpen={true} onClose={mockOnClose} asset={mockAsset} t={mockT as any} />
        );
        // The X icon button is the first button in the header
        fireEvent.click(screen.getAllByRole('button')[0]);
        expect(mockOnClose).toHaveBeenCalled();
    });

    it('purchaseDate input renders with local-time value when asset.purchaseDate is set', () => {
        // Use a fixed known timestamp: 2024-01-15 12:00:00 UTC
        const ts = new Date('2024-01-15T12:00:00.000Z').getTime();
        const assetWithDate = { ...mockAsset, purchaseDate: ts };
        render(
            <EditAssetModal isOpen={true} onClose={mockOnClose} asset={assetWithDate} t={mockT as any} />
        );
        // The datetime-local input value should be in local time, not UTC
        const expectedLocal = new Date(ts - new Date(ts).getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        const dateInput = screen.getByDisplayValue(expectedLocal);
        expect(dateInput).toBeInTheDocument();
    });

    it('purchaseDate input is enabled for synced (pionex) assets', () => {
        const syncedAsset = { ...mockAsset, source: 'pionex' as const, purchaseDate: Date.now() };
        render(
            <EditAssetModal isOpen={true} onClose={mockOnClose} asset={syncedAsset} t={mockT as any} />
        );
        const dateInputs = screen.getAllByDisplayValue(/.*/);
        const dateInput = dateInputs.find(el => (el as HTMLInputElement).type === 'datetime-local');
        expect(dateInput).toBeDefined();
        expect(dateInput).not.toBeDisabled();
        // Quantity input should still be disabled for synced assets
        const qtyInput = screen.getByDisplayValue('10');
        expect(qtyInput).toBeDisabled();
    });

    it('form submit calls db.assets.update with purchaseDate', async () => {
        const ts = Date.now();
        const assetWithDate = { ...mockAsset, purchaseDate: ts };
        render(
            <EditAssetModal isOpen={true} onClose={mockOnClose} asset={assetWithDate} t={mockT as any} />
        );
        fireEvent.submit(screen.getByRole('button', { name: /saveChanges/i }));
        await vi.waitFor(() => {
            expect(vi.mocked(db.assets.update)).toHaveBeenCalledWith(
                1,
                expect.objectContaining({ purchaseDate: ts })
            );
        });
    });
});
