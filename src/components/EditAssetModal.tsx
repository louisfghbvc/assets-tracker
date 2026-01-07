import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { db, type Asset } from '../db/database';
import { translations } from '../translations';

interface EditAssetModalProps {
    isOpen: boolean;
    onClose: () => void;
    asset: Asset | null;
    t: (key: keyof typeof translations.en) => string;
}

const EditAssetModal: React.FC<EditAssetModalProps> = ({ isOpen, onClose, asset, t }) => {
    const [quantity, setQuantity] = useState('');
    const [cost, setCost] = useState('');
    const [name, setName] = useState('');

    useEffect(() => {
        if (asset) {
            setQuantity(asset.quantity.toString());
            setCost(asset.cost.toString());
            setName(asset.name);
        }
    }, [asset, isOpen]);

    if (!isOpen || !asset) return null;

    const isSynced = asset.source === 'pionex' || asset.source === 'bitopro';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!asset.id) return;

        await db.assets.update(asset.id, {
            quantity: isSynced ? asset.quantity : parseFloat(quantity) || 0,
            cost: parseFloat(cost) || 0,
            name: name.trim() || asset.symbol,
            lastUpdated: Date.now()
        });

        onClose();
    };

    return (
        <div className="modal-overlay animate-fade-in" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>{t('editAsset')} ({asset.symbol})</h3>
                    <button className="close-btn" onClick={onClose}><X size={28} /></button>
                </div>

                <form onSubmit={handleSubmit} className="asset-form">
                    <div className="form-group">
                        <label>{t('assetDisplayName')}</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder={asset.symbol}
                        />
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>{t('quantity')}</label>
                            <input
                                type="number"
                                step="any"
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
                                disabled={isSynced}
                                className={isSynced ? 'disabled-input' : ''}
                            />
                            {isSynced && <p className="tip-small">{t('quantityReadOnly')}</p>}
                        </div>
                        <div className="form-group">
                            <label>{t('averageCost')}</label>
                            <input
                                type="number"
                                step="any"
                                value={cost}
                                onChange={(e) => setCost(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <button type="submit" className="submit-btn" style={{ background: 'var(--primary)' }}>
                        <Save size={24} />
                        <span>{t('saveChanges')}</span>
                    </button>
                </form>
            </div>
        </div>
    );
};

export default EditAssetModal;
