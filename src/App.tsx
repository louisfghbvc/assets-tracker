import { useState, useEffect, useMemo } from "react";
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
  CloudUpload,
  CloudDownload,
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
import { GOOGLE_CLIENT_ID } from "./config";

console.log("Google Client ID Loaded:", GOOGLE_CLIENT_ID ? "Yes" : "No (Empty)");

function App() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deletingSymbol, setDeletingSymbol] = useState<string | null>(null);
  const [deletingRecordId, setDeletingRecordId] = useState<number | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(localStorage.getItem("google_access_token"));
  const [syncStatus, setSyncStatus] = useState<string>("");
  const [exchangeRate, setExchangeRate] = useState<number>(32.5);
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'assets' | 'stats'>('assets');
  const [isLoggingOut, setIsLoggingOut] = useState(false);

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
      if (!groups[asset.symbol]) {
        groups[asset.symbol] = {
          name: /^\d+$/.test(asset.name) ? asset.symbol : asset.name,
          symbol: asset.symbol,
          market: asset.market,
          type: asset.type,
          quantity: asset.quantity,
          totalCostBasis: asset.quantity * asset.cost,
          currentPrice: asset.currentPrice || 0,
          items: [asset]
        };
      } else {
        const group = groups[asset.symbol];
        // Prefer descriptive names (non-numeric and longer)
        const isCurrentNumeric = /^\d+$/.test(group.name);
        const isNewNumeric = /^\d+$/.test(asset.name);
        if ((isCurrentNumeric && !isNewNumeric) ||
          (!isNewNumeric && asset.name.length > group.name.length)) {
          group.name = asset.name;
        }
        group.quantity += asset.quantity;
        group.totalCostBasis += asset.quantity * asset.cost;
        // Keep the latest current price if available
        if (asset.currentPrice) group.currentPrice = asset.currentPrice;
        group.items.push(asset);
      }
    });

    return Object.values(groups).map(group => ({
      ...group,
      cost: group.quantity > 0 ? group.totalCostBasis / group.quantity : 0,
    }));
  }, [assets]);

  const fetchExchangeRate = async () => {
    try {
      if (!(window as any).__TAURI_INTERNALS__) {
        console.log("Web version: Fetching exchange rate via public API...");
        const res = await fetch("https://open.er-api.com/v6/latest/USD");
        const data = await res.json();
        const rate = data.rates?.TWD || 32.5;
        setExchangeRate(rate);
        return rate;
      }
      const { invoke } = await import("@tauri-apps/api/core");
      const rate: number = await invoke("fetch_exchange_rate");
      setExchangeRate(rate);
      return rate;
    } catch (e) {
      console.error("Failed to fetch exchange rate:", e);
      setExchangeRate(32.5); // Fallback to hardcoded default
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
      setSyncStatus("Record deleted");
      setTimeout(() => setSyncStatus(""), 2000);
    } catch (err) {
      console.error("Failed to delete record:", err);
    }
  };

  const handleDeleteSymbol = async (symbol: string) => {
    console.log("handleDeleteSymbol executing for symbol:", symbol);
    try {
      const assetsToDelete = await db.assets.where("symbol").equals(symbol).toArray();
      for (const asset of assetsToDelete) {
        if (asset.id) await db.assets.delete(asset.id);
      }
      console.log(`Position for ${symbol} cleared from DB`);
      setSyncStatus(`Cleared all ${symbol} records`);
      setDeletingSymbol(null);
      setTimeout(() => setSyncStatus(""), 3000);
    } catch (err) {
      console.error("Failed to delete symbol:", err);
      setDeletingSymbol(null);
    }
  };

  const login = useGoogleLogin({
    onSuccess: (tokenResponse) => {
      setAccessToken(tokenResponse.access_token);
      localStorage.setItem("google_access_token", tokenResponse.access_token);
    },
    scope: "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file",
  });

  const handleCloudUpload = () => {
    if (!accessToken) {
      login();
      return;
    }
    performUpload();
  };

  const performUpload = async () => {
    setSyncStatus("Backing up to cloud...");
    const result = await syncService.upload(accessToken!);
    if (result.success) {
      setSyncStatus(`Backup successful! (${result.count} assets)`);
    } else {
      setSyncStatus(`Backup failed: ${result.error}`);
    }
    setTimeout(() => setSyncStatus(""), 3000);
  };

  const handleCloudDownload = () => {
    if (!accessToken) {
      login();
      return;
    }
    if (window.confirm("Restore from cloud? This will REPLACE all your local data.")) {
      performDownload();
    }
  };

  const performDownload = async () => {
    setSyncStatus("Restoring from cloud...");
    const result = await syncService.download(accessToken!);
    if (result.success) {
      setSyncStatus(`Restore successful! (${result.count} assets)`);
      await handleRefresh(); // Refresh prices immediately after restore
    } else {
      setSyncStatus(`Restore failed: ${result.error}`);
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

  const fetchPricesWeb = async (symbols: string[]) => {
    const results: { symbol: string; price: number }[] = [];
    const proxies = [
      "https://corsproxy.io/?",
      "https://api.allorigins.win/raw?url="
    ];

    for (const symbol of symbols) {
      let fetched = false;
      console.log(`Web Fetching: ${symbol}`);
      const timestamp = Date.now();
      const sanitizedSymbol = symbol.trim().split(/\s+/)[0]; // Extra layer of safety
      const yahooSymbol = sanitizedSymbol === 'BTC' ? 'BTC-USD' : sanitizedSymbol === 'ETH' ? 'ETH-USD' : sanitizedSymbol === 'SOL' ? 'SOL-USD' : sanitizedSymbol;

      const targetUrl = sanitizedSymbol.endsWith(".TW")
        ? `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=tse_${sanitizedSymbol.replace(".TW", "")}.tw&json=1&_=${timestamp}`
        : `https://query2.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1m&range=1d&_=${timestamp}`;

      for (const proxy of proxies) {
        try {
          const res = await fetch(`${proxy}${encodeURIComponent(targetUrl)}`);
          if (!res.ok) throw new Error(`Status ${res.status}`);

          let json: any;
          // AllOrigins raw returns text, corsproxy.io returns direct response
          const text = await res.text();
          try {
            json = JSON.parse(text);
          } catch (e) {
            // If it's the allorigins non-raw wrapped version (fallback)
            const wrapped = JSON.parse(text);
            json = JSON.parse(wrapped.contents);
          }

          if (symbol.endsWith(".TW")) {
            if (json.msgArray && json.msgArray[0]) {
              const msg = json.msgArray[0];
              const rawZ = msg.z;
              const rawY = msg.y;
              const rawB = msg.b?.split('_')[0];
              const rawA = msg.a?.split('_')[0];
              const finalPriceStr = (rawZ && rawZ !== "-") ? rawZ : (rawB && rawB !== "-") ? rawB : (rawA && rawA !== "-") ? rawA : rawY;
              const price = parseFloat(finalPriceStr || "0");
              if (price > 0 && !isNaN(price)) {
                results.push({ symbol, price });
                fetched = true;
                break;
              }
            }
          } else {
            const price = json.chart?.result?.[0]?.meta?.regularMarketPrice;
            if (price) {
              results.push({ symbol, price });
              fetched = true;
              break;
            }
          }
        } catch (e) {
          // Log skip info silently unless it's the last one
          if (proxy === proxies[proxies.length - 1]) {
            console.error(`Web Fetch finally failed for ${symbol} after trying all proxies.`);
          } else {
            console.log(`Proxy ${proxy} skipped for ${symbol}, trying fallback...`);
          }
          continue;
        }
      }

      // Special case for TWSE: If TSE fails, try OTC
      if (!fetched && symbol.endsWith(".TW")) {
        const code = symbol.replace(".TW", "");
        const otcUrl = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=otc_${code}.tw&json=1&_=${timestamp}`;
        for (const proxy of proxies) {
          try {
            const res = await fetch(`${proxy}${encodeURIComponent(otcUrl)}`);
            const text = await res.text();
            let json = JSON.parse(text);
            if (json.contents) json = JSON.parse(json.contents);

            if (json.msgArray && json.msgArray[0]) {
              const msg = json.msgArray[0];
              const finalPriceStr = (msg.z && msg.z !== "-") ? msg.z : (msg.b?.split('_')[0] !== "-") ? msg.b?.split('_')[0] : msg.y;
              const price = parseFloat(finalPriceStr || "0");
              if (price > 0 && !isNaN(price)) {
                results.push({ symbol, price });
                break;
              }
            }
          } catch (e) { continue; }
        }
      }
    }
    return results;
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setSyncStatus("Refreshing prices...");

    try {
      const allAssets = await db.assets.toArray();
      const uniqueSymbols = Array.from(new Set(allAssets.map(a => a.symbol)));
      let prices: { symbol: string, price: number }[] = [];

      if (!(window as any).__TAURI_INTERNALS__) {
        await fetchExchangeRate();
        if (uniqueSymbols.length > 0) {
          prices = await fetchPricesWeb(uniqueSymbols);
        }
      } else {
        const { invoke } = await import("@tauri-apps/api/core");
        await fetchExchangeRate();
        if (uniqueSymbols.length > 0) {
          prices = await invoke("fetch_prices", { symbols: uniqueSymbols });
        }
      }

      if (uniqueSymbols.length > 0) {
        if (prices.length === 0) {
          setSyncStatus("No prices returned from API");
        } else {
          let updatedCount = 0;
          const priceMap = new Map(prices.map(p => [p.symbol.trim(), p.price]));

          for (const asset of allAssets) {
            const trimmedSymbol = asset.symbol.trim();
            const newPrice = priceMap.get(trimmedSymbol);
            if (newPrice !== undefined && asset.id) {
              console.log(`Updating DB for ${trimmedSymbol}: ${newPrice}`);
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
          { recordId: crypto.randomUUID(), name: '台積電', symbol: '2330.TW', quantity: 1, cost: 600, currentPrice: 1040, type: 'stock', market: 'TW', lastUpdated: Date.now() },
          { recordId: crypto.randomUUID(), name: 'Apple Inc.', symbol: 'AAPL', quantity: 10, cost: 150, currentPrice: 220, type: 'stock', market: 'US', lastUpdated: Date.now() },
          { recordId: crypto.randomUUID(), name: 'Bitcoin', symbol: 'BTC', quantity: 0.5, cost: 30000, currentPrice: 95000, type: 'crypto', market: 'Crypto', lastUpdated: Date.now() },
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
            <button className="action-btn" onClick={handleCloudUpload} data-hint="備份至雲端">
              <CloudUpload size={24} />
            </button>
            <button className="action-btn" onClick={handleCloudDownload} data-hint="從雲端還原">
              <CloudDownload size={24} />
            </button>
            <button className="action-btn" onClick={handleRefresh} data-hint="重新整理市價">
              <RefreshCw size={24} className={isRefreshing ? "spin" : ""} />
            </button>
            {accessToken ? (
              <button
                className={`action-btn ${isLoggingOut ? 'confirm-mode' : ''}`}
                onClick={() => {
                  if (isLoggingOut) {
                    handleLogout();
                    setIsLoggingOut(false);
                  } else {
                    setIsLoggingOut(true);
                    setTimeout(() => setIsLoggingOut(false), 3000);
                  }
                }}
                data-hint={isLoggingOut ? "Confirm Logout?" : "Logout Account"}
              >
                {isLoggingOut ? (
                  <span className="confirm-text-small">Confirm?</span>
                ) : (
                  <LogOut size={24} />
                )}
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
              {mergedAssets?.map((asset) => (
                <div
                  key={asset.symbol}
                  className={`asset-item ${expandedSymbol === asset.symbol ? 'expanded' : ''}`}
                  onClick={() => setExpandedSymbol(expandedSymbol === asset.symbol ? null : asset.symbol)}
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
                      <p className="market-per-unit">
                        ${(asset.currentPrice || 0).toLocaleString()} / unit
                      </p>
                    </div>
                    <div className="asset-actions">
                      <button
                        className={`delete-item-btn ${deletingSymbol === asset.symbol ? 'confirm-mode' : ''}`}
                        title={deletingSymbol === asset.symbol ? "Confirm Deletion" : "Delete Asset"}
                        onClick={(e) => {
                          e.stopPropagation();
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
                          <span className="confirm-text">Confirm?</span>
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
                          <span className="label">Total Quantity</span>
                          <span className="value">{asset.quantity.toLocaleString()}</span>
                        </div>
                        <div className="summary-stat">
                          <span className="label">Avg Cost</span>
                          <span className="value">
                            ${asset.cost.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>

                      <div className="records-list">
                        <p className="records-header">Individual Records</p>
                        {asset.items.map((item: any, idx: number) => (
                          <div key={item.id || idx} className="record-item">
                            <div className="record-info">
                              <span className="record-qty">{item.quantity.toLocaleString()} units</span>
                              <span className="record-cost"> @ ${item.cost.toLocaleString()}</span>
                            </div>
                            <button
                              className={`record-delete-btn ${deletingRecordId === item.id ? 'confirm-mode' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
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
                              title={deletingRecordId === item.id ? "Confirm Deletion" : "Delete this record"}
                            >
                              {deletingRecordId === item.id ? (
                                <span className="confirm-text-small">Confirm?</span>
                              ) : (
                                <span style={{ fontSize: '18px', color: '#fff', fontWeight: 'bold' }}>✕</span>
                              )}
                            </button>
                          </div>
                        ))}
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
                      formatter={(value: any) => value !== undefined ? `$${Number(value).toLocaleString()}` : ''}
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
