import { useState, useEffect } from "react";
import {
  TrendingUp,
  Wallet,
  PieChart,
  RefreshCw,
  Plus,
  ChevronRight,
  ArrowUpRight,
  GanttChartSquare,
  LogIn,
  LogOut,
  CloudSync,
  Trash2
} from "lucide-react";
import {
  PieChart as RePieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend
} from 'recharts';
import "./App.css";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./db/database";
import { useGoogleLogin } from "@react-oauth/google";
import { syncService } from "./services/sync";
import AddAssetModal from "./components/AddAssetModal";

function App() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(localStorage.getItem("google_access_token"));
  const [syncStatus, setSyncStatus] = useState<string>("");
  const [exchangeRate, setExchangeRate] = useState<number>(32.5);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const [activeTab, setActiveTab] = useState<'assets' | 'stats'>('assets');

  const assets = useLiveQuery(() => db.assets.toArray());

  const fetchExchangeRate = async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const rate: number = await invoke("fetch_exchange_rate");
      setExchangeRate(rate);
      return rate;
    } catch (e) {
      console.error("Failed to fetch exchange rate:", e);
      return 32.5;
    }
  };

  useEffect(() => {
    fetchExchangeRate();
  }, []);

  const handleDeleteAsset = async (id: number) => {
    console.log("handleDeleteAsset executing for ID:", id);
    try {
      await db.assets.delete(id);
      console.log("Asset deleted from DB, ID:", id);
      setSyncStatus("Asset deleted successfully");
      setDeletingId(null);
      setTimeout(() => setSyncStatus(""), 3000);
    } catch (err) {
      console.error("Failed to delete asset:", err);
      setDeletingId(null);
    }
  };
  const login = useGoogleLogin({
    onSuccess: (tokenResponse) => {
      setAccessToken(tokenResponse.access_token);
      localStorage.setItem("google_access_token", tokenResponse.access_token);
    },
    scope: "https://www.googleapis.com/auth/spreadsheets",
  });

  const handleSync = async () => {
    if (!accessToken) {
      login();
      return;
    }
    setSyncStatus("Syncing...");
    const result = await syncService.sync(accessToken);
    if (result.success) {
      setSyncStatus(`Success! Synced ${result.count} assets`);
    } else {
      setSyncStatus(`Sync Failed: ${result.error}`);
    }
    setTimeout(() => setSyncStatus(""), 3000);
  };

  const handleLogout = () => {
    setAccessToken(null);
    localStorage.removeItem("google_access_token");
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

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setSyncStatus("Refreshing prices...");

    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await fetchExchangeRate();

      const allAssets = await db.assets.toArray();
      const uniqueSymbols = Array.from(new Set(allAssets.map(a => a.symbol)));

      if (uniqueSymbols.length > 0) {
        console.log("Refreshing prices for symbols:", uniqueSymbols);
        const prices: { symbol: string, price: number }[] = await invoke("fetch_prices", { symbols: uniqueSymbols });
        console.log("Received prices:", prices);

        if (prices.length === 0) {
          setSyncStatus("No prices returned from API");
        } else {
          let updatedCount = 0;
          const priceMap = new Map(prices.map(p => [p.symbol, p.price]));

          for (const asset of allAssets) {
            const newPrice = priceMap.get(asset.symbol);
            if (newPrice !== undefined && asset.id) {
              await db.assets.update(asset.id, {
                currentPrice: newPrice,
                lastUpdated: Date.now()
              });
              updatedCount++;
            }
          }
          setSyncStatus(`Updated ${updatedCount} prices`);
        }
      } else {
        setSyncStatus("No assets to refresh");
      }
    } catch (e) {
      console.error("Price refresh failed:", e);
      setSyncStatus("Refresh failed. Check console.");

      // Fallback: Seed data if empty and error occurs (only if count is 0)
      const count = await db.assets.count();
      if (count === 0) {
        await db.assets.bulkAdd([
          { name: '台積電', symbol: '2330.TW', quantity: 1, cost: 600, currentPrice: 1040, type: 'stock', market: 'TW', lastUpdated: Date.now() },
          { name: 'Apple Inc.', symbol: 'AAPL', quantity: 10, cost: 150, currentPrice: 220, type: 'stock', market: 'US', lastUpdated: Date.now() },
          { name: 'Bitcoin', symbol: 'BTC', quantity: 0.5, cost: 30000, currentPrice: 95000, type: 'crypto', market: 'Crypto', lastUpdated: Date.now() },
        ]);
      }
    } finally {
      setIsRefreshing(false);
      setTimeout(() => setSyncStatus(""), 3000);
    }
  };

  // Chart data calculation
  const marketData = assets ? [
    { name: 'TW Stocks', value: assets.filter(a => a.market === 'TW').reduce((s, a) => s + (a.currentPrice || 0) * a.quantity, 0) },
    { name: 'US Stocks', value: assets.filter(a => a.market === 'US').reduce((s, a) => s + (a.currentPrice || 0) * a.quantity, 0) },
    { name: 'Crypto', value: assets.filter(a => a.market === 'Crypto').reduce((s, a) => s + (a.currentPrice || 0) * a.quantity, 0) },
  ].filter(d => d.value > 0) : [];

  const COLORS = ["#3b82f6", "#6366f1", "#10b981", "#8b5cf6"];

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
            {syncStatus && <span className="sync-status-msg">{syncStatus}</span>}
            <button className="action-btn sync-btn" onClick={handleSync} data-hint="同步至雲端">
              <CloudSync size={24} />
            </button>
            <button className="action-btn" onClick={handleRefresh} data-hint="重新整理市價">
              <RefreshCw size={24} className={isRefreshing ? "spin" : ""} />
            </button>
            {accessToken ? (
              <button className="action-btn" onClick={handleLogout} data-hint="登出帳號">
                <LogOut size={24} />
              </button>
            ) : (
              <button className="action-btn" onClick={() => login()} data-hint="使用 Google 登入">
                <LogIn size={24} />
              </button>
            )}
          </div>
        </div>

        <div className="balance-section">
          <p className="balance-label">Total Balance (NTD)</p>
          <h1 className="balance-amount">
            ${totalBalance.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </h1>
          <div className="balance-stat">
            <span className={`stat-value ${Number(balanceChange) >= 0 ? 'positive' : 'negative'}`}>
              {Number(balanceChange) >= 0 ? '+' : ''}${Math.abs(Number(balanceChange)).toLocaleString()} ({balanceChangePercent}%)
            </span>
            <span className="stat-label">than yesterday</span>
          </div>
        </div>
      </header>

      {/* Conditional Rendering based on Tab */}
      {activeTab === 'assets' && (
        <>
          {/* Quick Stats */}
          <section className="stats-grid animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <div className="stat-card">
              <div className="stat-icon tw"><ArrowUpRight size={20} /></div>
              <div>
                <p className="stat-card-label">TW Stocks</p>
                <p className="stat-card-value">
                  ${((assets?.filter(a => a.market === 'TW').reduce((s, a) => s + (a.currentPrice || 0) * a.quantity, 0) || 0) / 1000).toFixed(1)}k
                </p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon us"><ArrowUpRight size={20} /></div>
              <div>
                <p className="stat-card-label">US Stocks</p>
                <p className="stat-card-value">
                  ${((assets?.filter(a => a.market === 'US').reduce((s, a) => s + (a.currentPrice || 0) * a.quantity, 0) || 0) * exchangeRate / 1000).toFixed(1)}k
                </p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon crypto"><ArrowUpRight size={20} /></div>
              <div>
                <p className="stat-card-label">Crypto</p>
                <p className="stat-card-value">
                  ${((assets?.filter(a => a.market === 'Crypto').reduce((s, a) => s + (a.currentPrice || 0) * a.quantity, 0) || 0) * exchangeRate / 1000).toFixed(1)}k
                </p>
              </div>
            </div>
          </section>

          {/* Assets List */}
          <section className="assets-section animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <div className="section-header">
              <h2>Your Assets</h2>
              <button className="add-btn" onClick={() => setIsModalOpen(true)}>
                <Plus size={24} />
              </button>
            </div>

            <div className="assets-list">
              {assets?.map((asset) => (
                <div
                  key={asset.id}
                  className={`asset-item ${expandedId === asset.id ? 'expanded' : ''}`}
                  onClick={() => setExpandedId(expandedId === asset.id ? null : (asset.id || null))}
                >
                  <div className="asset-summary">
                    <div className="asset-icon">
                      {asset.market === 'TW' ? <TrendingUp size={24} /> : asset.market === 'US' ? <TrendingUp size={24} /> : <Wallet size={24} />}
                    </div>
                    <div className="asset-info">
                      <p className="asset-name">{asset.name}</p>
                      <p className="asset-symbol">{asset.symbol}</p>
                    </div>
                    <div className="asset-market">
                      <p className="asset-price">
                        ${((asset.currentPrice || 0) * asset.quantity).toLocaleString()}
                        <span className="currency-unit"> {asset.market === 'TW' ? 'TWD' : 'USD'}</span>
                      </p>
                    </div>
                    <div className="asset-actions">
                      <button
                        className={`delete-item-btn ${deletingId === asset.id ? 'confirm-mode' : ''}`}
                        title={deletingId === asset.id ? "Confirm Deletion" : "Delete Asset"}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (deletingId === asset.id) {
                            if (asset.id !== undefined) handleDeleteAsset(asset.id);
                          } else {
                            setDeletingId(asset.id || null);
                            setTimeout(() => {
                              setDeletingId(current => current === asset.id ? null : current);
                            }, 3000);
                          }
                        }}
                      >
                        {deletingId === asset.id ? (
                          <span className="confirm-text">Confirm?</span>
                        ) : (
                          <Trash2 size={22} color="white" />
                        )}
                      </button>
                      <ChevronRight size={20} className={`expand-chevron ${expandedId === asset.id ? 'rotated' : ''}`} />
                    </div>
                  </div>

                  {expandedId === asset.id && (
                    <div className="asset-details-expanded animate-slide-down">
                      <div className="detail-grid">
                        <div className="detail-item">
                          <span className="detail-label">Quantity</span>
                          <span className="detail-value">{asset.quantity.toLocaleString()}</span>
                        </div>
                        <div className="detail-item">
                          <span className="detail-label">Avg Cost</span>
                          <span className="detail-value">${asset.cost.toLocaleString()}</span>
                        </div>
                        <div className="detail-item">
                          <span className="detail-label">Unit Price</span>
                          <span className="detail-value">${(asset.currentPrice || 0).toLocaleString()}</span>
                        </div>
                        <div className="detail-item">
                          <span className="detail-label">Profit/Loss</span>
                          <span className={`detail-value ${(asset.currentPrice || 0) >= asset.cost ? 'positive' : 'negative'}`}>
                            {asset.cost !== 0 ? (((asset.currentPrice || 0) - asset.cost) / asset.cost * 100).toFixed(2) : "0.00"}%
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {assets?.length === 0 && (
                <div className="empty-state" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  <p>No assets found. Click the + button to add one.</p>
                </div>
              )}
            </div>
          </section>
        </>
      )}

      {activeTab === 'stats' && (
        <section className="stats-view animate-fade-in">
          <div className="card chart-container">
            <h2 className="view-title">Portfolio Allocation</h2>
            {marketData.length > 0 ? (
              <div className="chart-wrapper">
                <ResponsiveContainer width="100%" height={300}>
                  <RePieChart>
                    <Pie
                      data={marketData}
                      cx="50%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {marketData.map((_entry, index) => (
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
                      formatter={(value: number) => `$${value.toLocaleString()}`}
                    />
                    <Legend verticalAlign="bottom" height={36} />
                  </RePieChart>
                </ResponsiveContainer>
                <div className="chart-center-label">
                  <p className="label">Total</p>
                  <p className="amount">${(totalBalance / 1000).toFixed(1)}k</p>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <PieChart size={64} color="var(--primary)" style={{ marginBottom: '20px', opacity: 0.5 }} />
                <p style={{ color: 'var(--text-muted)' }}>No data to display. Add some assets first!</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Modal */}
      <AddAssetModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAssetAdded={() => {
          console.log("Asset added, triggering immediate refresh...");
          handleRefresh();
        }}
      />
      {/* Tab Bar (for Mobile) */}
      <nav className="tab-bar">
        <div className={`tab-item ${activeTab === 'assets' ? 'active' : ''}`} onClick={() => setActiveTab('assets')}>
          <TrendingUp size={24} />
          <span>Assets</span>
        </div>
        <div className={`tab-item ${activeTab === 'stats' ? 'active' : ''}`} onClick={() => setActiveTab('stats')}>
          <PieChart size={24} />
          <span>Stats</span>
        </div>
      </nav>
    </div>
  );
}

export default App;
