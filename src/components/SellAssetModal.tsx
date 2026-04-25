import React, { useState, useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import { type Asset } from '../db/database';
import { sellAsset, ValidationError } from '../services/portfolio';

interface SellAssetModalProps {
    isOpen: boolean;
    onClose: () => void;
    asset: Asset | null;
    currentExchangeRate: number;
    onSold?: () => void;
}

const SellAssetModal: React.FC<SellAssetModalProps> = ({
    isOpen,
    onClose,
    asset,
    currentExchangeRate,
    onSold,
}) => {
    const [soldQuantity, setSoldQuantity] = useState('');
    const [sellPrice, setSellPrice] = useState('');
    const [sellDateStr, setSellDateStr] = useState('');
    const [fees, setFees] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const today = new Date().toISOString().split('T')[0];

    useEffect(() => {
        if (!isOpen || !asset) return;
        setSoldQuantity('');
        setSellPrice(asset.currentPrice ? String(asset.currentPrice) : '');
        setSellDateStr(today);
        setFees('');
        setError(null);
        setIsSubmitting(false);
    }, [isOpen, asset]);

    const preview = useMemo(() => {
        if (!asset) return null;
        const qty = parseFloat(soldQuantity);
        const price = parseFloat(sellPrice);
        const feesNum = parseFloat(fees) || 0;
        if (isNaN(qty) || isNaN(price) || qty <= 0 || price <= 0) return null;
        const gain = (price - asset.cost) * qty - feesNum;
        let gainTWD: number | undefined;
        if (asset.market !== 'TW') gainTWD = gain * currentExchangeRate;
        return { gain, gainTWD };
    }, [soldQuantity, sellPrice, fees, asset, currentExchangeRate]);

    const isBackdated = sellDateStr !== today;

    if (!isOpen || !asset) return null;

    const handleSubmit = async () => {
        if (isSubmitting) return;
        setError(null);

        const qty = parseFloat(soldQuantity);
        const price = parseFloat(sellPrice);
        const feesNum = fees ? parseFloat(fees) : undefined;

        if (isNaN(qty) || qty <= 0) { setError('請輸入有效數量'); return; }
        if (qty > asset.quantity) { setError('數量超過持倉'); return; }
        if (isNaN(price) || price <= 0) { setError('請輸入有效賣出價格'); return; }
        if (feesNum !== undefined && isNaN(feesNum)) { setError('請輸入有效手續費'); return; }

        const sellDate = sellDateStr ? new Date(sellDateStr).getTime() : Date.now();

        setIsSubmitting(true);
        try {
            await sellAsset({
                assetId: asset.id!,
                soldQuantity: qty,
                sellPrice: price,
                sellDate,
                fees: feesNum,
                exchangeRateAtSale: asset.market !== 'TW' ? currentExchangeRate : undefined,
            });
            onSold?.();
            onClose();
        } catch (e) {
            if (e instanceof ValidationError) {
                setError(e.message);
            } else {
                setError('賣出失敗，請重試');
            }
            setIsSubmitting(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>賣出 {asset.symbol}</h2>
                    <button className="modal-close-btn" onClick={onClose}><X size={20} /></button>
                </div>

                <div className="modal-body">
                    <div className="form-group">
                        <label>持倉數量</label>
                        <div className="readonly-value">{asset.quantity}</div>
                    </div>

                    <div className="form-group">
                        <label>賣出數量 *</label>
                        <input
                            type="number"
                            min="0"
                            max={asset.quantity}
                            step="any"
                            value={soldQuantity}
                            onChange={e => setSoldQuantity(e.target.value)}
                            placeholder={`最多 ${asset.quantity}`}
                            className="modal-input"
                        />
                    </div>

                    <div className="form-group">
                        <label>賣出價格 (每股) *</label>
                        <input
                            type="number"
                            min="0"
                            step="any"
                            value={sellPrice}
                            onChange={e => setSellPrice(e.target.value)}
                            placeholder="每單位價格"
                            className="modal-input"
                        />
                    </div>

                    <div className="form-group">
                        <label>賣出日期 *</label>
                        <input
                            type="date"
                            value={sellDateStr}
                            onChange={e => setSellDateStr(e.target.value)}
                            className="modal-input"
                        />
                    </div>

                    <div className="form-group">
                        <label>手續費 (選填)</label>
                        <input
                            type="number"
                            min="0"
                            step="any"
                            value={fees}
                            onChange={e => setFees(e.target.value)}
                            placeholder="0"
                            className="modal-input"
                        />
                    </div>

                    {preview !== null && (
                        <div className={`sell-preview ${preview.gain >= 0 ? 'gain' : 'loss'}`}>
                            <span className="preview-label">已實現損益預覽：</span>
                            <span className="preview-value">
                                {preview.gain >= 0 ? '+' : ''}
                                {preview.gain.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                {asset.market !== 'TW' ? ' USD' : ' TWD'}
                            </span>
                            {preview.gainTWD !== undefined && (
                                <span className="preview-twd">
                                    {' '}≈ {preview.gainTWD >= 0 ? '+' : ''}
                                    {preview.gainTWD.toLocaleString(undefined, { maximumFractionDigits: 0 })} TWD
                                    {isBackdated && <span className="approx-label"> (近似值)</span>}
                                </span>
                            )}
                        </div>
                    )}

                    {error && <div className="modal-error">{error}</div>}
                </div>

                <div className="modal-footer">
                    <button className="modal-cancel-btn" onClick={onClose} disabled={isSubmitting}>取消</button>
                    <button
                        className="modal-sell-btn"
                        onClick={handleSubmit}
                        disabled={isSubmitting || !soldQuantity || !sellPrice}
                    >
                        {isSubmitting ? '處理中...' : '確認賣出'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SellAssetModal;
