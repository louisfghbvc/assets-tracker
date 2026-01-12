import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AddAssetModal from '../AddAssetModal';
import { translations } from '../../translations';

import { db } from '../../db/database';

// Mock DB
vi.mock('../../db/database', () => ({
    db: {
        assets: {
            add: vi.fn(),
        },
    },
}));

// Mock Search Service
vi.mock('../../services/search', () => ({
    searchService: {
        search: vi.fn().mockResolvedValue([]),
    },
}));

describe('AddAssetModal', () => {
    const mockProps = {
        isOpen: true,
        onClose: vi.fn(),
        onAssetAdded: vi.fn(),
        t: (key: string) => (translations.en as any)[key] || key,
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should not render when isOpen is false', () => {
        render(<AddAssetModal {...mockProps} isOpen={false} />);
        expect(screen.queryByText('Add New Asset')).not.toBeInTheDocument();
    });

    it('should render form fields when open', () => {
        render(<AddAssetModal {...mockProps} />);
        expect(screen.getByText('Add New Asset')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Start typing to search...')).toBeInTheDocument();
        expect(screen.getByText('Quantity')).toBeInTheDocument();
        expect(screen.getByText('Average Cost')).toBeInTheDocument();
    });

    it('should call onClose when close button is clicked', () => {
        render(<AddAssetModal {...mockProps} />);
        const closeBtn = screen.getByRole('button', { name: '' }); // Lucide X button might not have text
        // Alternative: find by SVG or specific class if needed, but let's try finding the button
        const buttons = screen.getAllByRole('button');
        const xButton = buttons[0]; // Usually the first one in the header
        fireEvent.click(xButton);
        expect(mockProps.onClose).toHaveBeenCalled();
    });

    it('should switch markets correctly', () => {
        render(<AddAssetModal {...mockProps} />);
        const usBtn = screen.getByText('US Stocks');
        fireEvent.click(usBtn);
        expect(usBtn).toHaveClass('active');

        const cryptoBtn = screen.getByText('Crypto');
        fireEvent.click(cryptoBtn);
        expect(cryptoBtn).toHaveClass('active');
    });

    it('should submit a new TW stock correctly', async () => {
        render(<AddAssetModal {...mockProps} />);

        // Set market to TW
        fireEvent.click(screen.getByText('TW Stocks'));

        // Fill form
        fireEvent.change(screen.getByPlaceholderText('Start typing to search...'), { target: { value: '2330' } });

        const inputs = screen.getAllByPlaceholderText('0.00');
        fireEvent.change(inputs[0], { target: { value: '10' } }); // Quantity
        fireEvent.change(inputs[1], { target: { value: '600' } }); // Cost

        fireEvent.submit(screen.getByRole('button', { name: /Add Asset/i }));

        expect(vi.mocked(db.assets.add)).toHaveBeenCalledWith(expect.objectContaining({
            symbol: '2330.TW',
            quantity: 10,
            cost: 600,
            market: 'TW'
        }));
    });

    it('should submit a new US stock correctly', async () => {
        render(<AddAssetModal {...mockProps} />);

        // Set market to US
        fireEvent.click(screen.getByText('US Stocks'));

        // Fill form
        fireEvent.change(screen.getByPlaceholderText('Start typing to search...'), { target: { value: 'AAPL' } });
        const inputs = screen.getAllByPlaceholderText('0.00');
        fireEvent.change(inputs[0], { target: { value: '5' } });
        fireEvent.change(inputs[1], { target: { value: '150' } });

        fireEvent.submit(screen.getByRole('button', { name: /Add Asset/i }));

        expect(vi.mocked(db.assets.add)).toHaveBeenCalledWith(expect.objectContaining({
            symbol: 'AAPL',
            quantity: 5,
            cost: 150,
            market: 'US'
        }));
    });

    it('should submit a new Crypto correctly', async () => {
        render(<AddAssetModal {...mockProps} />);

        // Set market to Crypto
        fireEvent.click(screen.getByText('Crypto'));

        // Fill form
        fireEvent.change(screen.getByPlaceholderText('Start typing to search...'), { target: { value: 'BTC' } });
        const inputs = screen.getAllByPlaceholderText('0.00');
        fireEvent.change(inputs[0], { target: { value: '0.1' } });
        fireEvent.change(inputs[1], { target: { value: '50000' } });

        fireEvent.submit(screen.getByRole('button', { name: /Add Asset/i }));

        expect(vi.mocked(db.assets.add)).toHaveBeenCalledWith(expect.objectContaining({
            symbol: 'BTC-USD',
            quantity: 0.1,
            cost: 50000,
            market: 'Crypto'
        }));
    });
});
