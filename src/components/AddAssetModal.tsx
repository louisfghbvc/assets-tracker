import React, { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { db } from '../db/database';

interface AddAssetModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const AddAssetModal: React.FC<AddAssetModalProps> = ({ isOpen, onClose }) => {
    const [symbol, setSymbol] = useState('');
    const [name, setName] = useState('');
    const [market, setMarket] = useState<'TW' | 'US' | 'Crypto'>('TW');
    const [quantity, setQuantity] = useState('');
    const [cost, setCost] = useState('');

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        await db.assets.add({
            symbol: symbol.toUpperCase(),
            name,
            type: market === 'Crypto' ? 'crypto' : 'stock',
            market,
            quantity: parseFloat(quantity),
            cost: parseFloat(cost),
            currentPrice: parseFloat(cost), // Initialize with cost
            lastUpdated: Date.now(),
        });

        // Reset and close
        setSymbol('');
        setName('');
        setQuantity('');
        setCost('');
        onClose();
    };

    return (
        <div className="modal-overlay animate-fade-in">
            <div className="modal-content">
                <div className="modal-header">
                    <h3>Add New Asset</h3>
                    <button className="close-btn" onClick={onClose}><X size={20} /></button>
                </div>

                <form onSubmit={handleSubmit} className="asset-form">
                    <div className="form-group">
                        <label>Market</label>
                        <div className="market-selector">
                            {(['TW', 'US', 'Crypto'] as const).map((m) => (
                                <button
                                    key={m}
                                    type="button"
                                    className={`market-btn ${market === m ? 'active' : ''}`}
                                    onClick={() => setMarket(m)}
                                >
                                    {m}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Symbol (e.g., 2330.TW, AAPL, BTC)</label>
                        <input
                            type="text"
                            value={symbol}
                            onChange={(e) => setSymbol(e.target.value)}
                            placeholder="Enter symbol..."
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Asset name..."
                            required
                        />
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Quantity</label>
                            <input
                                type="number"
                                step="any"
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
                                placeholder="0.00"
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Average Cost</label>
                            <input
                                type="number"
                                step="any"
                                value={cost}
                                onChange={(e) => setCost(e.target.value)}
                                placeholder="0.00"
                                required
                            />
                        </div>
                    </div>

                    <button type="submit" className="submit-btn">
                        <Plus size={18} />
                        <span>Add Asset</span>
                    </button>
                </form>
            </div>
        </div>
    );
};

export default AddAssetModal;
