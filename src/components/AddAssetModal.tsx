import React, { useState, useEffect, useCallback } from 'react';
import { X, Plus, Loader2 } from 'lucide-react';
import { db } from '../db/database';
import { searchService, SearchResult } from '../services/search';
import { translations } from '../translations';

interface AddAssetModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAssetAdded?: () => void;
    t: (key: keyof typeof translations.en) => string;
}

const AddAssetModal: React.FC<AddAssetModalProps> = ({ isOpen, onClose, onAssetAdded, t }) => {
    const [symbol, setSymbol] = useState('');
    const [name, setName] = useState('');
    const [market, setMarket] = useState<'TW' | 'US' | 'Crypto'>('TW');
    const [quantity, setQuantity] = useState('');
    const [cost, setCost] = useState('');

    // Search states
    const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);

    useEffect(() => {
        if (!isOpen) {
            setSymbol('');
            setName('');
            setQuantity('');
            setCost('');
            setSuggestions([]);
            setShowSuggestions(false);
        }
    }, [isOpen]);

    const performSearch = useCallback(async (query: string, currentMarket: 'TW' | 'US' | 'Crypto') => {
        if (query.length < 2) {
            setSuggestions([]);
            return;
        }

        setIsSearching(true);
        const results = await searchService.search(query, currentMarket);
        setSuggestions(results);
        setIsSearching(false);
        setShowSuggestions(results.length > 0);
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (symbol && !name) { // Only search if symbol is typed but name isn't manually set yet
                performSearch(symbol, market);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [symbol, market, performSearch, name]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Sanitize: Take only the first "word" in case the name got mixed in (e.g. from a bad parse)
        let finalSymbol = symbol.trim().split(/\s+/)[0].toUpperCase();

        if (market === 'TW' && !finalSymbol.includes('.')) {
            finalSymbol = `${finalSymbol}.TW`;
        } else if (market === 'Crypto' && !finalSymbol.includes('-')) {
            finalSymbol = `${finalSymbol}-USD`;
        }

        await db.assets.add({
            recordId: crypto.randomUUID(),
            symbol: finalSymbol,
            name: name.trim() || finalSymbol,
            type: market === 'Crypto' ? 'crypto' : 'stock',
            market,
            quantity: parseFloat(quantity) || 0,
            cost: parseFloat(cost) || 0,
            currentPrice: parseFloat(cost) || 0, // Initialize with cost
            lastUpdated: Date.now(),
            source: 'manual'
        });

        // Trigger refresh in parent
        if (onAssetAdded) onAssetAdded();

        onClose();
    };

    const handleSelectSuggestion = (s: SearchResult) => {
        setSymbol(s.symbol);
        setName(s.name);
        setMarket(s.market);
        setShowSuggestions(false);
    };

    return (
        <div className="modal-overlay animate-fade-in" onClick={() => setShowSuggestions(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>{t('addNewAsset')}</h3>
                    <button className="close-btn" onClick={onClose}><X size={28} /></button>
                </div>

                <form onSubmit={handleSubmit} className="asset-form">
                    <div className="form-group">
                        <label>{t('market')}</label>
                        <div className="market-selector">
                            {(['TW', 'US', 'Crypto'] as const).map((m) => (
                                <button
                                    key={m}
                                    type="button"
                                    className={`market-btn ${market === m ? 'active' : ''}`}
                                    onClick={() => {
                                        setMarket(m);
                                        setSuggestions([]);
                                    }}
                                >
                                    {t(m === 'TW' ? 'twMarket' : m === 'US' ? 'usMarket' : 'cryptoMarket')}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="form-group" style={{ position: 'relative' }}>
                        <label>
                            {market === 'TW' ? t('searchTW') :
                                market === 'US' ? t('searchUS') :
                                    t('searchCrypto')}
                        </label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type="text"
                                value={symbol}
                                onChange={(e) => {
                                    setSymbol(e.target.value);
                                    if (name) setName(''); // Clear auto-filled name if user re-types
                                }}
                                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                                placeholder={t('searchPlaceholder')}
                                required
                                autoComplete="off"
                            />
                            {isSearching && (
                                <div style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--primary)' }}>
                                    <Loader2 size={20} className="spin" />
                                </div>
                            )}
                        </div>

                        {showSuggestions && (
                            <div className="suggestions-container">
                                {suggestions.map((s, idx) => (
                                    <div
                                        key={`${s.symbol}-${idx}`}
                                        className="suggestion-item"
                                        onClick={() => handleSelectSuggestion(s)}
                                    >
                                        <div className="suggestion-main">
                                            <span className="suggestion-symbol">{s.symbol}</span>
                                            <span className="suggestion-name">{s.name}</span>
                                        </div>
                                        <div className="suggestion-type">{s.market} {s.type}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="form-group">
                        <label>{t('assetDisplayName')}</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder={t('placeholderName')}
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
                                placeholder="0.00"
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>{t('averageCost')}</label>
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
                        <Plus size={24} />
                        <span>{t('addAsset')}</span>
                    </button>
                </form>
            </div>
        </div>
    );
};

export default AddAssetModal;
