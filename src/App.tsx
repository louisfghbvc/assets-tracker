import { useState, useEffect, useMemo, useRef } from "react";
import {
  TrendingUp,
  Wallet,
  PieChart,
  RefreshCw,
  Plus,
  ChevronRight,
  ArrowUpRight,
  LogOut,
  CloudUpload,
  CloudDownload,
  Trash2,
  GanttChartSquare,
  Eye,
  EyeOff,
  Pencil
} from "lucide-react";
import {
  PieChart as RePieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip
} from 'recharts';
import "./App.css";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./db/database";
import { useGoogleLogin } from "@react-oauth/google";
import { syncService } from "./services/sync";
import { priceService } from "./services/price";
import { exchangeService } from "./services/exchange";
import AddAssetModal from "./components/AddAssetModal";
import EditAssetModal from "./components/EditAssetModal";
import { translations, Language } from "./translations";

const failedLogos = new Set<string>();

const AssetLogo = ({ symbol, market, fallbackIcon }: { symbol: string, market: string, fallbackIcon: React.ReactNode }) => {
  const [hasError, setHasError] = useState(false);

  const logoUrl = useMemo(() => {
    const s = symbol.includes(':') ? symbol.split(':')[1].trim().toUpperCase() : symbol.trim().toUpperCase();
    const cleanS = s.replace('.TW', '').replace('.TWO', '').trim();
    const cacheKey = `${market}:${cleanS}`;

    if (failedLogos.has(cacheKey) || hasError) return null;

    if (market === 'TW') {
      // Skip ETFs (usually starting with 00) for Taiwan to reduce noise
      if (cleanS.startsWith('00')) return null;
      // User verified that financialmodelingprep with .TW.png works for 2330.TW
      return `https://financialmodelingprep.com/image-stock/${cleanS}.TW.png`;
    }

    if (market === 'US') {
      return `https://financialmodelingprep.com/image-stock/${cleanS}.png`;
    }

    if (market === 'Crypto') {
      const cryptoSymbol = s.split('-')[0].toLowerCase();
      return `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${cryptoSymbol}.png`;
    }

    return null;
  }, [symbol, market, hasError]);

  if (!logoUrl) return <>{fallbackIcon}</>;

  return (
    <div className="asset-logo-container">
      <img
        src={logoUrl}
        alt={symbol}
        onError={() => {
          const s = symbol.includes(':') ? symbol.split(':')[1].trim().toUpperCase() : symbol.trim().toUpperCase();
          const cleanS = s.replace('.TW', '').replace('.TWO', '').trim();
          failedLogos.add(`${market}:${cleanS}`);
          setHasError(true);
        }}
        className="asset-logo-img"
      />
    </div>
  );
};

function App() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deletingSymbol, setDeletingSymbol] = useState<string | null>(null);
  const [deletingRecordId, setDeletingRecordId] = useState<number | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(localStorage.getItem("google_access_token"));

  const [syncStatus, setSyncStatus] = useState<string>("");
  const [exchangeRate, setExchangeRate] = useState<number>(32.5);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<any>(null);
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'assets' | 'stats' | 'settings'>('assets');
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [marketFilter, setMarketFilter] = useState<string | null>(null);
  const [statsView, setStatsView] = useState<'market' | 'asset'>('asset');
  const [userProfile, setUserProfile] = useState<{ name: string, email: string, picture: string } | null>(null);
  const [hideValues, setHideValues] = useState<boolean>(() => {
    return localStorage.getItem("hideValues") === "true";
  });
  const [hasInitialRefreshed, setHasInitialRefreshed] = useState(false);

  // Persist hideValues
  useEffect(() => {
    localStorage.setItem("hideValues", hideValues.toString());
  }, [hideValues]);

  // Helper to mask values
  const displayValue = (value: string | number, prefix: string = "") => {
    if (hideValues) return "****";
    return typeof value === "number" ? `${prefix}${value.toLocaleString()}` : `${prefix}${value}`;
  };

  const compactDisplayValue = (value: number, prefix: string = "") => {
    if (hideValues) return "****";
    if (Math.abs(value) >= 1000) {
      return `${prefix}${(value / 1000).toFixed(1)}k`;
    }
    return `${prefix}${value.toFixed(1)}`;
  };

  const [language, setLanguage] = useState<Language>((localStorage.getItem("app_language") as Language) || 'zh');

  const t = (key: keyof typeof translations.en) => {
    return translations[language][key] || translations.en[key] || key;
  };

  const toggleLanguage = () => {
    const newLang = language === 'zh' ? 'en' : 'zh';
    setLanguage(newLang);
    localStorage.setItem("app_language", newLang);
  };

  // Initialize from local storage
  useEffect(() => {
    const storedToken = localStorage.getItem("google_access_token");
    const storedProfile = localStorage.getItem("user_profile");

    if (storedToken) {
      setAccessToken(storedToken);
      if (storedProfile) {
        setUserProfile(JSON.parse(storedProfile));
      } else {
        fetchUserProfile(storedToken);
      }
    }
  }, []);

  const initialRefreshStarted = useRef(false);

  // Auto-refresh on startup when token is available
  useEffect(() => {
    if (accessToken && !hasInitialRefreshed && !initialRefreshStarted.current) {
      initialRefreshStarted.current = true;
      setHasInitialRefreshed(true);
      handleRefresh();
    }
  }, [accessToken, hasInitialRefreshed]);

  const fetchUserProfile = async (token: string) => {
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v1/userinfo?alt=json', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 401) {
        handleLogout();
        setSyncStatus(t('sessionExpired'));
        return;
      }
      if (res.ok) {
        const data = await res.json();
        const profile = { name: data.name, email: data.email, picture: data.picture };
        setUserProfile(profile);
        localStorage.setItem('user_profile', JSON.stringify(profile));
      }
    } catch (e) {
      console.error("Failed to fetch user profile", e);
    }
  };

  const assets = useLiveQuery(() => db.assets.toArray());

  const mergedAssets = useMemo(() => {
    if (!assets) return [];

    const groups: Record<string, {
      name: string;
      symbol: string;
      market: string;
      type: string;
      quantity: number;
      totalCostBasis: number;
      currentPrice: number;
      items: any[];
    }> = {};

    assets.forEach(asset => {
      // Safety/Fallback: Normalize market in-memory if migration failed
      let currentMarket = asset.market;
      const m = currentMarket?.toUpperCase();
      if (m === 'CRYPTO') currentMarket = 'Crypto';
      else if (m === 'TW') currentMarket = 'TW';
      else if (m === 'US') currentMarket = 'US';

      if (!groups[asset.symbol]) {
        groups[asset.symbol] = {
          name: asset.name,
          symbol: asset.symbol,
          market: currentMarket,
          type: asset.type,
          quantity: asset.quantity,
          totalCostBasis: asset.quantity * asset.cost,
          currentPrice: asset.currentPrice || 0,
          items: [asset]
        };
      } else {
        const group = groups[asset.symbol];
        group.quantity += asset.quantity;
        group.totalCostBasis += asset.quantity * asset.cost;
        if (asset.currentPrice) group.currentPrice = asset.currentPrice;
        group.items.push(asset);
      }
    });

    return Object.values(groups).map(group => {
      const totalValue = group.quantity * group.currentPrice;
      const profit = group.totalCostBasis > 0 ? totalValue - group.totalCostBasis : 0;
      const profitPercent = group.totalCostBasis > 0 ? (profit / group.totalCostBasis) * 100 : 0;

      return {
        ...group,
        cost: group.totalCostBasis > 0 && group.quantity > 0 ? group.totalCostBasis / group.quantity : 0,
        totalValue,
        profit,
        profitPercent
      };
    });
  }, [assets]);

  const exchangeConfigs = useLiveQuery(() => db.exchangeConfigs.toArray());

  const marketStats = useMemo(() => {
    const stats: Record<string, { totalValue: number, totalCost: number }> = {
      'TW': { totalValue: 0, totalCost: 0 },
      'US': { totalValue: 0, totalCost: 0 },
      'Crypto': { totalValue: 0, totalCost: 0 }
    };

    assets?.forEach(asset => {
      let market = asset.market;
      const m = market?.toUpperCase();
      if (m === 'CRYPTO') market = 'Crypto';
      else if (m === 'TW') market = 'TW';
      else if (m === 'US') market = 'US';

      if (stats[market]) {
        const itemValue = (asset.currentPrice || 0) * asset.quantity;
        const itemCost = asset.cost * asset.quantity;
        stats[market].totalValue += itemValue;
        stats[market].totalCost += itemCost;
      }
    });

    return Object.entries(stats).map(([market, val]) => {
      const profit = val.totalValue - val.totalCost;
      const profitPercent = val.totalCost !== 0 ? (profit / val.totalCost) * 100 : 0;
      return {
        market,
        totalValue: val.totalValue,
        profit,
        profitPercent
      };
    });
  }, [assets]);

  const fetchExchangeRate = async () => {
    const rate = await priceService.fetchExchangeRate();
    setExchangeRate(rate);
    return rate;
  };

  useEffect(() => {
    fetchExchangeRate();
  }, []);

  const requireAuth = async () => {
    if (!accessToken) {
      login();
      return false;
    }
    return true;
  };

  const handleDeleteAsset = async (id: number) => {
    if (!(await requireAuth())) return;
    try {
      await db.assets.delete(id);
      setSyncStatus("Record deleted");
      setTimeout(() => setSyncStatus(""), 2000);
    } catch (err) {
      console.error("Failed to delete record:", err);
    }
  };

  const handleDeleteSymbol = async (symbol: string) => {
    if (!(await requireAuth())) return;
    try {
      const assetsToDelete = await db.assets.where("symbol").equals(symbol).toArray();
      for (const asset of assetsToDelete) {
        if (asset.id) await db.assets.delete(asset.id);
      }
      setSyncStatus(`Cleared all ${symbol} records`);
      setDeletingSymbol(null);
      setTimeout(() => setSyncStatus(""), 3000);
    } catch (err) {
      console.error("Failed to delete symbol:", err);
      setDeletingSymbol(null);
    }
  };

  const login = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setAccessToken(tokenResponse.access_token);
      localStorage.setItem("google_access_token", tokenResponse.access_token);

      // Fetch User Profile immediately after login
      await fetchUserProfile(tokenResponse.access_token);

      // Removed Auto-sync to prevent overwriting local work
      // User must manually choose to Backup (Upload) or Restore (Download)
    },
    scope: "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.metadata.readonly https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email",
  });

  const handleCloudUpload = async () => {
    if (!(await requireAuth())) return;
    setSyncStatus("Uploading to cloud...");
    performUpload();
  };

  const performUpload = async (tokenOverride?: string) => {
    const token = tokenOverride || accessToken;
    if (!token) return;

    setSyncStatus("Backing up to cloud...");
    const result = await syncService.upload(token);
    if (result.success) {
      setSyncStatus(`Backup successful! (${result.count} assets)`);
    } else {
      if (result.error === "UNAUTHORIZED") {
        handleLogout();
        setSyncStatus(t('sessionExpired'));
      } else {
        setSyncStatus(`Backup failed: ${result.error}`);
      }
    }
    setTimeout(() => setSyncStatus(""), 3000);
  };

  const handleCloudDownload = async () => {
    if (!(await requireAuth())) return;
    if (window.confirm("Restore from cloud? This will REPLACE all your local data.")) {
      performDownload();
    }
  };

  const performDownload = async (tokenOverride?: string, suppressLogout = false) => {
    const token = tokenOverride || accessToken;
    if (!token) return;

    setSyncStatus("Restoring from cloud...");
    const result = await syncService.download(token);
    if (result.success) {
      setSyncStatus(`Restore successful! (${result.count} assets)`);
      await handleRefresh();
    } else {
      if (result.error === "UNAUTHORIZED") {
        if (!suppressLogout) {
          handleLogout();
          setSyncStatus(t('sessionExpired'));
        } else {
          console.warn("Sync failed with UNAUTHORIZED, but logout suppressed (initial login).");
          setSyncStatus("Sync failed. Please try again manually.");
        }
      } else {
        setSyncStatus(`Restore failed: ${result.error}`);
      }
    }
    setTimeout(() => setSyncStatus(""), 3000);
  };

  const handleLogout = () => {
    setAccessToken(null);
    setUserProfile(null);
    localStorage.removeItem("google_access_token");
    localStorage.removeItem("user_profile");
    // Removed: localStorage.removeItem("google_spreadsheet_id");
  };

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setSyncStatus("Refreshing...");

    try {
      setSyncStatus("Syncing exchanges...");
      const configs = await db.exchangeConfigs.toArray();
      for (const config of configs) {
        try {
          await exchangeService.syncBalances(config);
        } catch (e) {
          console.error(`Failed to sync ${config.exchangeName}:`, e);
        }
      }

      setSyncStatus("Refreshing prices...");
      await fetchExchangeRate();
      const allAssets = await db.assets.toArray();
      const uniqueSymbols = Array.from(new Set(allAssets.map(a => a.symbol)));

      if (uniqueSymbols.length > 0) {
        const prices = await priceService.fetchPrices(uniqueSymbols);
        if (prices.length > 0) {
          const priceMap = new Map(prices.map(p => [p.symbol.trim(), p.price]));
          for (const asset of allAssets) {
            const trimmedSymbol = asset.symbol.trim();
            const newPrice = priceMap.get(trimmedSymbol);
            if (newPrice !== undefined && asset.id) {
              await db.assets.update(asset.id, {
                currentPrice: newPrice,
                lastUpdated: Date.now()
              });
            }
          }
        }
      }

      setSyncStatus("Refresh complete!");
    } catch (e) {
      console.error("Refresh failed:", e);
      setSyncStatus("Refresh failed.");
    } finally {
      setIsRefreshing(false);
      setTimeout(() => setSyncStatus(""), 3000);
    }
  };

  const totalBalance = assets?.reduce((sum, asset) => {
    const value = (asset.currentPrice || 0) * asset.quantity;
    return sum + (asset.market === 'TW' ? value : value * exchangeRate);
  }, 0) || 0;

  const yesterdayBalance = assets?.reduce((sum, asset) => {
    const value = asset.cost * asset.quantity;
    return sum + (asset.market === 'TW' ? value : value * exchangeRate);
  }, 0) || 0;

  const balanceChange = totalBalance - yesterdayBalance;
  const balanceChangePercent = yesterdayBalance !== 0 ? ((balanceChange / yesterdayBalance) * 100).toFixed(1) : "0.0";

  const marketData = assets ? [
    { name: 'TW Stocks', value: assets.filter(a => a.market === 'TW').reduce((s, a) => s + (a.currentPrice || 0) * a.quantity, 0) },
    { name: 'US Stocks', value: assets.filter(a => a.market === 'US').reduce((s, a) => s + (a.currentPrice || 0) * a.quantity, 0) * exchangeRate },
    { name: 'Crypto', value: assets.filter(a => a.market === 'Crypto').reduce((s, a) => s + (a.currentPrice || 0) * a.quantity, 0) * exchangeRate },
  ].filter(d => d.value > 0) : [];

  const exchangeTotals = useMemo(() => {
    if (!assets) return {};
    return assets.reduce((acc, asset) => {
      const value = (asset.currentPrice || 0) * asset.quantity;
      const valueTwd = asset.market === 'TW' ? value : value * exchangeRate;
      acc[asset.source] = (acc[asset.source] || 0) + valueTwd;
      return acc;
    }, {} as Record<string, number>);
  }, [assets, exchangeRate]);

  const assetData = useMemo(() => {
    if (!mergedAssets) return [];
    return mergedAssets
      .map(asset => ({
        name: asset.symbol,
        value: asset.market === 'TW' ? asset.totalValue : asset.totalValue * exchangeRate
      }))
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [mergedAssets, exchangeRate]);

  const COLORS = ["#3b82f6", "#6366f1", "#10b981", "#8b5cf6", "#f59e0b", "#ec4899", "#84cc16", "#06b6d4"];

  // ---------------------------------------------------------
  // RENDER CONDITIONAL: LOGIN SCREEN vs APP
  // ---------------------------------------------------------

  if (!accessToken) {
    return (
      <div className="login-container">
        <div className="login-card animate-fade-in">
          <div className="login-header">
            <div className="login-icon">
              <Wallet size={48} color="#3b82f6" />
            </div>
            <h1>{t('loginTitle')}</h1>
            <p>{t('loginSubtitle')}</p>
          </div>
          <button className="login-btn-large" onClick={() => login()}>
            <div className="google-icon-wrapper">
              <svg className="google-icon" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
              </svg>
            </div>
            <span>{t('signInWithGoogle')}</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header animate-fade-in">
        <div className="header-top">
          <div className="logo-group">
            <div className="icon-bg">
              <GanttChartSquare size={32} color="var(--primary)" />
            </div>
            <span>AssetTracker</span>
          </div>
          <div className="header-actions">
            {exchangeRate > 1 && (
              <span className="exchange-rate-badge">USD/TWD: {exchangeRate.toFixed(2)}</span>
            )}
            {/* syncStatus moved to root for Toast positioning */}
            <button className="action-btn lang-btn" onClick={toggleLanguage} data-hint={language === 'zh' ? 'Switch to English' : '切換至中文'}>
              <span style={{ fontWeight: 800, fontSize: '0.8rem' }}>{language === 'zh' ? 'EN' : '中'}</span>
            </button>
            <button className="action-btn" onClick={handleCloudUpload} data-hint={t('backupToCloud')}>
              <CloudUpload size={24} />
            </button>
            <button className="action-btn" onClick={handleCloudDownload} data-hint={t('restoreFromCloud')}>
              <CloudDownload size={24} />
            </button>
            <button className="action-btn" onClick={handleRefresh} data-hint={t('refreshPrices')}>
              <RefreshCw size={24} className={isRefreshing ? "spin" : ""} />
            </button>
            {userProfile ? (
              <div
                className={`user-profile-badge ${isLoggingOut ? 'confirm-mode' : ''}`}
                onClick={() => {
                  if (isLoggingOut) {
                    handleLogout();
                    setIsLoggingOut(false);
                  } else {
                    setIsLoggingOut(true);
                    setTimeout(() => setIsLoggingOut(false), 3000);
                  }
                }}
                data-hint={isLoggingOut ? t('confirmLogout') : t('logoutAccount')}
              >
                <img src={userProfile.picture} alt={userProfile.name} className="user-avatar" referrerPolicy="no-referrer" />
                <span className="user-name-text">{isLoggingOut ? t('confirm') : userProfile.name}</span>
              </div>
            ) : (
              /* Fallback if userProfile missing but token exists */
              <button className="action-btn" onClick={handleLogout}>
                <LogOut size={24} />
              </button>
            )}
          </div>
        </div>

        <div className="balance-section">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <p className="balance-label">{t('totalBalance')}</p>
            <button
              onClick={() => setHideValues(!hideValues)}
              style={{
                background: 'none',
                border: 'none',
                padding: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)'
              }}
            >
              {hideValues ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <h1 className="balance-amount">
            {displayValue(totalBalance, '$')}
          </h1>
          <div className="balance-stat">
            <span className={`stat-value ${Number(balanceChange) >= 0 ? 'positive' : 'negative'}`}>
              {displayValue(Math.abs(Number(balanceChange)), Number(balanceChange) >= 0 ? '+$' : '$')} ({balanceChangePercent}%)
            </span>
            <span className="stat-label">{t('totalProfit')}</span>
          </div>
        </div>
      </header>

      {/* Conditional Rendering based on Tab */}
      {activeTab === 'assets' && (
        <>
          {/* Quick Stats */}
          <section className="stats-grid animate-fade-in" style={{ animationDelay: '0.1s' }}>
            {marketStats.map((stat) => (
              <div
                key={stat.market}
                className={`stat-card ${marketFilter === stat.market ? 'active' : ''}`}
                onClick={() => setMarketFilter(prev => prev === stat.market ? null : stat.market)}
                style={{ cursor: 'pointer' }}
              >
                <div className={`stat-icon ${stat.market.toLowerCase()}`}><ArrowUpRight size={20} /></div>
                <div className="stat-card-content">
                  <div className="stat-card-header">
                    <p className="stat-card-label">{stat.market === 'TW' ? t('twStocks') : stat.market === 'US' ? t('usStocks') : t('crypto')}</p>
                    <span className={`stat-card-pct ${stat.profitPercent >= 0 ? 'positive' : 'negative'}`}>
                      {compactDisplayValue(Math.abs(stat.profit), stat.profit >= 0 ? '+$' : '$')} ({stat.profitPercent >= 0 ? '+' : ''}{stat.profitPercent.toFixed(1)}%)
                    </span>
                  </div>
                  <p className="stat-card-value">
                    {hideValues ? '****' : `$${(stat.totalValue / (stat.market === 'TW' ? 1000 : 1)).toFixed(1)}${stat.market === 'TW' ? 'k' : ''}`}
                  </p>
                </div>
              </div>
            ))}
          </section>

          {/* Assets List */}
          <section className="assets-section animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <div className="section-header">
              <h2>{t('yourAssets')}</h2>
              <button className="add-btn" onClick={async () => {
                if (await requireAuth()) setIsModalOpen(true);
              }}>
                <Plus size={24} />
              </button>
            </div>

            <div className="assets-list">
              {mergedAssets?.filter(a => !marketFilter || a.market === marketFilter).map((asset) => (
                <div
                  key={asset.symbol}
                  className={`asset-item ${expandedSymbol === asset.symbol ? 'expanded' : ''}`}
                  onClick={() => setExpandedSymbol(expandedSymbol === asset.symbol ? null : asset.symbol)}
                >
                  <div className="asset-summary">
                    <div className="asset-icon">
                      <AssetLogo
                        symbol={asset.symbol}
                        market={asset.market}
                        fallbackIcon={asset.market === 'TW' ? <TrendingUp size={24} /> : asset.market === 'US' ? <TrendingUp size={24} /> : <Wallet size={24} />}
                      />
                    </div>
                    <div className="asset-info">
                      <p className="asset-name">{asset.name}</p>
                      <p className="asset-symbol">{asset.symbol}</p>
                    </div>
                    <div className="asset-market">
                      <div className="asset-value-group">
                        <p className="asset-price">
                          {displayValue(asset.totalValue, '$')}
                          <span className="currency-unit"> {asset.market === 'TW' ? 'TWD' : 'USD'}</span>
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {asset.items.some(i => i.source === 'pionex' || i.source === 'bitopro') && (
                            <span
                              className="source-badge"
                              title={asset.items.some(i => i.source === 'pionex') && asset.items.some(i => i.source === 'bitopro')
                                ? `${t('pionex')} & ${t('bitopro')}`
                                : asset.items.find(i => i.source === 'pionex') ? t('pionex') : t('bitopro')}
                            >
                              {asset.items.find(i => i.source === 'pionex') ? 'P' : 'B'}
                            </span>
                          )}
                          <span className={`asset-profit-badge ${asset.profitPercent >= 0 ? 'positive' : 'negative'}`}>
                            {displayValue(Math.abs(asset.profit), asset.profit >= 0 ? '+$' : '$')} ({asset.profitPercent >= 0 ? '+' : ''}{asset.profitPercent.toFixed(1)}%)
                          </span>
                        </div>
                      </div>
                      <p className="market-per-unit">
                        {displayValue(asset.currentPrice || 0, '$')} {t('perUnit')}
                      </p>
                    </div>
                    <div className="asset-actions">
                      <button
                        className={`delete-item-btn ${deletingSymbol === asset.symbol ? 'confirm-mode' : ''}`}
                        title={deletingSymbol === asset.symbol ? t('confirmDeletion') : t('deleteAsset')}
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (!(await requireAuth())) return;
                          if (deletingSymbol === asset.symbol) {
                            handleDeleteSymbol(asset.symbol);
                          } else {
                            setDeletingSymbol(asset.symbol);
                            setTimeout(() => {
                              setDeletingSymbol(current => current === asset.symbol ? null : current);
                            }, 3000);
                          }
                        }}
                      >
                        {deletingSymbol === asset.symbol ? (
                          <span className="confirm-text">{t('confirm')}</span>
                        ) : (
                          <Trash2 size={22} color="white" />
                        )}
                      </button>
                      <ChevronRight size={20} className={`expand-chevron ${expandedSymbol === asset.symbol ? 'rotated' : ''}`} />
                    </div>
                  </div>

                  {expandedSymbol === asset.symbol && (
                    <div className="asset-details-expanded animate-slide-down">
                      <div className="position-summary">
                        <div className="summary-stat">
                          <span className="label">{t('totalQuantity')}</span>
                          <span className="value">{displayValue(asset.quantity)}</span>
                        </div>
                        <div className="summary-stat">
                          <span className="label">{t('avgCost')}</span>
                          <span className="value">
                            {displayValue(asset.cost, '$')}
                          </span>
                        </div>
                      </div>

                      <div className="records-list">
                        <p className="records-header">{t('individualRecords')}</p>
                        {asset.items.map((item: any, idx: number) => (
                          <div key={item.id || idx} className="record-item">
                            <div className="record-info">
                              <span className="record-qty">{displayValue(item.quantity)} {t('units')}</span>
                              <span className="record-cost"> {t('at')} {displayValue(item.cost, '$')}</span>
                              <span className="record-source"> ({item.source === 'manual' ? t('manual') : t(item.source as any)})</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <button
                                className="edit-item-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingAsset(item);
                                  setIsEditModalOpen(true);
                                }}
                                title={t('editAsset')}
                              >
                                <Pencil size={16} />
                              </button>
                              <button
                                className={`record-delete-btn ${deletingRecordId === item.id ? 'confirm-mode' : ''}`}
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (!(await requireAuth())) return;
                                  if (deletingRecordId === item.id) {
                                    if (item.id) handleDeleteAsset(item.id);
                                    setDeletingRecordId(null);
                                  } else {
                                    setDeletingRecordId(item.id || null);
                                    setTimeout(() => {
                                      setDeletingRecordId(curr => curr === item.id ? null : curr);
                                    }, 3000);
                                  }
                                }}
                                title={deletingRecordId === item.id ? t('confirmDeletion') : t('deleteRecord')}
                              >
                                {deletingRecordId === item.id ? (
                                  <span className="confirm-text-small">{t('confirm')}</span>
                                ) : (
                                  <span style={{ fontSize: '18px', color: '#fff', fontWeight: 'bold' }}>✕</span>
                                )}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {assets?.length === 0 && (
                <div className="empty-state" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  <p>{t('noAssets')}</p>
                </div>
              )}
            </div>
          </section>
        </>
      )}

      {activeTab === 'settings' && (
        <section className="settings-view animate-fade-in">
          <div className="card settings-container">
            <h2 className="view-title">{t('exchanges')}</h2>
            <div className="exchange-list">
              {exchangeConfigs?.map(config => (
                <div key={config.id} className="exchange-config-card">
                  <div className="exchange-info">
                    <p className="exchange-name">{t(config.exchangeName as any)}</p>
                    <p className="exchange-sync-time">
                      {t('lastSynced')}: {config.lastSynced ? new Date(config.lastSynced).toLocaleString() : t('never')}
                    </p>
                    {exchangeTotals[config.exchangeName] > 0 && (
                      <p className="exchange-balance-total">
                        {displayValue(exchangeTotals[config.exchangeName], '$')} TWD
                      </p>
                    )}
                  </div>
                  <div className="exchange-actions">
                    <button
                      className="inline-sync-btn"
                      onClick={() => exchangeService.syncBalances(config)}
                      title={t('syncExchange')}
                    >
                      <RefreshCw size={18} />
                    </button>
                    <button
                      className="inline-delete-btn"
                      onClick={() => {
                        if (config.id && window.confirm(t('confirmDeleteExchange'))) {
                          exchangeService.deleteExchange(config.id, config.exchangeName);
                        }
                      }}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="add-exchange-form card-sub">
              <h3>{t('addExchange')}</h3>
              <p className="tip">{t('readOnlyTip')}</p>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const name = formData.get('exchangeName') as 'pionex' | 'bitopro';
                const key = formData.get('apiKey') as string;
                const secret = formData.get('apiSecret') as string;

                if (name && key && secret) {
                  await db.exchangeConfigs.add({
                    exchangeName: name,
                    apiKey: key,
                    apiSecret: secret
                  });
                  (e.target as HTMLFormElement).reset();
                }
              }}>
                <select name="exchangeName" className="settings-select" required>
                  <option value="pionex">{t('pionex')}</option>
                  <option value="bitopro">{t('bitopro')}</option>
                </select>
                <input name="apiKey" type="text" placeholder={t('apiKey')} className="settings-input" required />
                <input name="apiSecret" type="password" placeholder={t('apiSecret')} className="settings-input" required />
                <button type="submit" className="settings-save-btn">{t('addExchange')}</button>
              </form>
            </div>
          </div>
        </section>
      )}
      {activeTab === 'stats' && (
        <section className="stats-view animate-fade-in">
          <div className="card chart-container">
            <div className="stats-header">
              <h2 className="view-title">{t('allocation')}</h2>
              <div className="stats-toggle">
                <button
                  className={`toggle-btn ${statsView === 'market' ? 'active' : ''}`}
                  onClick={() => setStatsView('market')}
                >
                  {t('byMarket')}
                </button>
                <button
                  className={`toggle-btn ${statsView === 'asset' ? 'active' : ''}`}
                  onClick={() => setStatsView('asset')}
                >
                  {t('byAsset')}
                </button>
              </div>
            </div>

            {(statsView === 'market' ? marketData.length : assetData.length) > 0 ? (
              <div className="chart-wrapper">
                <ResponsiveContainer width="100%" height={300}>
                  <RePieChart>
                    <Pie
                      data={statsView === 'market' ? marketData : assetData}
                      cx="50%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {(statsView === 'market' ? marketData : assetData).map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: 'rgba(18, 18, 23, 0.9)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: '12px',
                        color: '#fff'
                      }}
                      itemStyle={{ color: '#fff' }}
                      formatter={(value: any) => value !== undefined ? `$${Number(value).toLocaleString()}` : ''}
                    />
                  </RePieChart>
                </ResponsiveContainer>
                <div className="chart-center-label">
                  <p className="label">{t('total')}</p>
                  <p className="amount">${(totalBalance / 1000).toFixed(1)}k</p>
                </div>

                <div className="custom-legend-container">
                  {(statsView === 'market' ? marketData : assetData).map((entry, index) => {
                    const total = (statsView === 'market' ? marketData : assetData).reduce((s, i) => s + i.value, 0);
                    const percent = total > 0 ? (entry.value / total * 100).toFixed(1) : '0.0';
                    return (
                      <div key={entry.name} className="custom-legend-item">
                        <div className="legend-info">
                          <span className="legend-color-dot" style={{ background: COLORS[index % COLORS.length] }}></span>
                          <span className="legend-text">{entry.name}</span>
                        </div>
                        <span className="legend-percent">{percent}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <PieChart size={64} color="var(--primary)" style={{ marginBottom: '20px', opacity: 0.5 }} />
                <p style={{ color: 'var(--text-muted)' }}>{t('noData')}</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Modal */}
      <AddAssetModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAssetAdded={() => handleRefresh()}
        t={t}
      />

      <EditAssetModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        asset={editingAsset}
        t={t}
      />

      {/* Tab Bar (for Mobile) */}
      <nav className="tab-bar">
        <div className={`tab-item ${activeTab === 'assets' ? 'active' : ''}`} onClick={() => setActiveTab('assets')}>
          <TrendingUp size={24} />
          <span>{t('assets')}</span>
        </div>
        <div className={`tab-item ${activeTab === 'stats' ? 'active' : ''}`} onClick={() => setActiveTab('stats')}>
          <PieChart size={24} />
          <span>{t('stats')}</span>
        </div>
        <div className={`tab-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
          <GanttChartSquare size={24} />
          <span>{t('settings')}</span>
        </div>
      </nav>

      {/* Global Toast Notification - FORCE INLINE STYLES */}
      {syncStatus && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'fixed',
          top: '12%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'rgba(20, 20, 25, 0.9)',
          border: '1px solid rgba(59, 130, 246, 0.5)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          zIndex: 999999,
          padding: '12px 24px',
          fontSize: '1rem',
          fontWeight: 600,
          borderRadius: '20px',
          width: 'max-content',
          maxWidth: '90vw',
          textAlign: 'center',
          color: 'white',
          backdropFilter: 'blur(12px)',
          animation: 'simpleFadeIn 0.3s ease'
        }}>
          {syncStatus}
        </div>
      )}
    </div>
  );
}

export default App;
