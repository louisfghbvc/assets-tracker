import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EditAssetModal from '../EditAssetModal';

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
});
