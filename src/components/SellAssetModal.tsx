import React, { useState, useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import { type Asset } from '../db/database';
import { sellAsset, ValidationError } from '../services/portfolio';
import { translations, Language } from '../translations';

interface SellAssetModalProps {
    isOpen: boolean;
    onClose: () => void;
    asset: Asset | null;
    currentExchangeRate: number;
    onSold?: () => void;
    language: Language;
}

const SellAssetModal: React.FC<SellAssetModalProps> = ({
    isOpen,
    onClose,
    asset,
    currentExchangeRate,
    onSold,
    language,
}) => {
    const t = (key: keyof typeof translations.en) =>
        translations[language][key] || translations.en[key] || key;
    const [soldQuantity, setSoldQuantity] = useState('');
    const [sellPrice, setSellPrice] = useState('');
    const [sellDateStr, setSellDateStr] = useState('');
    const [fees, setFees] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const today = new Date().toLocaleDateString('sv');

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

        if (isNaN(qty) || qty <= 0) { setError(t('invalidQtyError')); return; }
        if (qty > asset.quantity) { setError(t('exceedsHoldingsError')); return; }
        if (isNaN(price) || price <= 0) { setError(t('invalidSellPriceError')); return; }
        if (feesNum !== undefined && isNaN(feesNum)) { setError(t('invalidFeesError')); return; }

        const sellDate = sellDateStr
            ? (() => { const [y, m, d] = sellDateStr.split('-').map(Number); return new Date(y, m - 1, d).getTime(); })()
            : (() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime(); })();

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
                setError(t('sellFailedError'));
            }
            setIsSubmitting(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>{t('soldAction')} {asset.symbol}</h2>
                    <button className="modal-close-btn" onClick={onClose}><X size={20} /></button>
                </div>

                <div className="modal-body">
                    <div className="form-group">
                        <label>{t('heldQuantity')}</label>
                        <div className="readonly-value">{asset.quantity}</div>
                    </div>

                    <div className="form-group">
                        <label>{t('sellQuantity')} *</label>
                        <input
                            type="number"
                            min="0"
                            max={asset.quantity}
                            step="any"
                            value={soldQuantity}
                            onChange={e => { setSoldQuantity(e.target.value); setError(null); }}
                            placeholder={`Max ${asset.quantity}`}
                            className="modal-input"
                        />
                    </div>

                    <div className="form-group">
                        <label>{t('sellPriceLabel')} *</label>
                        <input
                            type="number"
                            min="0"
                            step="any"
                            value={sellPrice}
                            onChange={e => { setSellPrice(e.target.value); setError(null); }}
                            placeholder={t('pricePerUnit')}
                            className="modal-input"
                        />
                    </div>

                    <div className="form-group">
                        <label>{t('sellDateLabel')} *</label>
                        <input
                            type="date"
                            value={sellDateStr}
                            onChange={e => { setSellDateStr(e.target.value); setError(null); }}
                            className="modal-input"
                        />
                    </div>

                    <div className="form-group">
                        <label>{t('feesLabel')}</label>
                        <input
                            type="number"
                            min="0"
                            step="any"
                            value={fees}
                            onChange={e => { setFees(e.target.value); setError(null); }}
                            placeholder="0"
                            className="modal-input"
                        />
                    </div>

                    {preview !== null && (
                        <div className={`sell-preview ${preview.gain >= 0 ? 'gain' : 'loss'}`}>
                            <span className="preview-label">{t('realizedPreview')}</span>
                            <span className="preview-value">
                                {preview.gain >= 0 ? '+' : ''}
                                {preview.gain.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                {asset.market !== 'TW' ? ' USD' : ' TWD'}
                            </span>
                            {preview.gainTWD !== undefined && (
                                <span className="preview-twd">
                                    {' '}≈ {preview.gainTWD >= 0 ? '+' : ''}
                                    {preview.gainTWD.toLocaleString(undefined, { maximumFractionDigits: 0 })} TWD
                                    {isBackdated && <span className="approx-label"> ({t('approx')})</span>}
                                </span>
                            )}
                        </div>
                    )}

                    {error && <div className="modal-error">{error}</div>}
                </div>

                <div className="modal-footer">
                    <button className="modal-cancel-btn" onClick={onClose} disabled={isSubmitting}>{t('cancel')}</button>
                    <button
                        className="modal-sell-btn"
                        onClick={handleSubmit}
                        disabled={isSubmitting || !soldQuantity || !sellPrice}
                    >
                        {isSubmitting ? t('processing') : t('confirmSell')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SellAssetModal;
