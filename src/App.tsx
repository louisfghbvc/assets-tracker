import { useState } from "react";
import {
  TrendingUp,
  Wallet,
  PieChart,
  RefreshCw,
  Plus,
  ChevronRight,
  ArrowUpRight,
  GanttChartSquare
} from "lucide-react";
import "./App.css";

interface Asset {
  id: string;
  name: string;
  symbol: string;
  value: number;
  change: number;
  type: 'TW' | 'US' | 'Crypto';
}

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./db/database";
import { useGoogleLogin } from "@react-oauth/google";
import { syncService } from "./services/sync";

function App() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(localStorage.getItem("google_access_token"));
  const [syncStatus, setSyncStatus] = useState<string>("");

  const assets = useLiveQuery(() => db.assets.toArray());

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

  const totalBalance = assets?.reduce((sum, asset) => sum + (asset.currentPrice || 0) * asset.quantity, 0) || 0;
  const yesterdayBalance = totalBalance * 0.98; // Mock comparison
  const balanceChange = totalBalance - yesterdayBalance;
  const balanceChangePercent = ((balanceChange / yesterdayBalance) * 100).toFixed(1);

  const handleRefresh = async () => {
    setIsRefreshing(true);

    // Seed data if empty (for demonstration)
    const count = await db.assets.count();
    if (count === 0) {
      await db.assets.bulkAdd([
        { name: '台積電', symbol: '2330.TW', quantity: 1, cost: 600, currentPrice: 1040, type: 'stock', market: 'TW', lastUpdated: Date.now() },
        { name: 'Apple Inc.', symbol: 'AAPL', quantity: 10, cost: 150, currentPrice: 220, type: 'stock', market: 'US', lastUpdated: Date.now() },
        { name: 'Bitcoin', symbol: 'BTC', quantity: 0.5, cost: 30000, currentPrice: 95000, type: 'crypto', market: 'Crypto', lastUpdated: Date.now() },
      ]);
    }

    setTimeout(() => setIsRefreshing(false), 1500);
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header animate-fade-in">
        <div className="header-top">
          <div className="logo-group">
            <div className="icon-bg">
              <GanttChartSquare size={24} color="var(--primary)" />
            </div>
            <span>AssetTracker</span>
          </div>
          <div className="header-actions">
            {syncStatus && <span className="sync-status-msg">{syncStatus}</span>}
            <button className="action-btn sync-btn" onClick={handleSync} title="Sync to Sheets">
              <CloudSync size={18} />
            </button>
            <button className="action-btn" onClick={handleRefresh} title="Fresh Data">
              <RefreshCw size={18} className={isRefreshing ? "spin" : ""} />
            </button>
            {accessToken ? (
              <button className="action-btn" onClick={handleLogout} title="Logout">
                <LogOut size={18} />
              </button>
            ) : (
              <button className="action-btn" onClick={() => login()} title="Login with Google">
                <LogIn size={18} />
              </button>
            )}
          </div>
        </div>

        <div className="balance-section">
          <p className="balance-label">Total Balance</p>
          <h1 className="balance-amount">
            ${totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </h1>
          <div className="balance-section">
          </div>
          <div className="balance-stat">
            <span className={`stat-value ${Number(balanceChange) >= 0 ? 'positive' : 'negative'}`}>
              {Number(balanceChange) >= 0 ? '+' : ''}${Math.abs(Number(balanceChange)).toLocaleString()} ({balanceChangePercent}%)
            </span>
            <span className="stat-label">than yesterday</span>
          </div>
        </div>
      </header>

      {/* Quick Stats */}
      <section className="stats-grid animate-fade-in" style={{ animationDelay: '0.1s' }}>
        <div className="stat-card">
          <div className="stat-icon tw"><ArrowUpRight size={16} /></div>
          <div>
            <p className="stat-card-label">TW Stocks</p>
            <p className="stat-card-value">
              ${(assets?.filter(a => a.market === 'TW').reduce((s, a) => s + (a.currentPrice || 0) * a.quantity, 0) || 0 / 1000).toFixed(1)}k
            </p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon us"><ArrowUpRight size={16} /></div>
          <div>
            <p className="stat-card-label">US Stocks</p>
            <p className="stat-card-value">
              ${(assets?.filter(a => a.market === 'US').reduce((s, a) => s + (a.currentPrice || 0) * a.quantity, 0) || 0 / 1000).toFixed(1)}k
            </p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon crypto"><ArrowUpRight size={16} /></div>
          <div>
            <p className="stat-card-label">Crypto</p>
            <p className="stat-card-value">
              ${(assets?.filter(a => a.market === 'Crypto').reduce((s, a) => s + (a.currentPrice || 0) * a.quantity, 0) || 0 / 1000).toFixed(1)}k
            </p>
          </div>
        </div>
      </section>

      {/* Assets List */}
      <section className="assets-section animate-fade-in" style={{ animationDelay: '0.2s' }}>
        <div className="section-header">
          <h2>Your Assets</h2>
          <button className="add-btn"><Plus size={18} /></button>
        </div>

        <div className="assets-list">
          {assets?.map((asset) => (
            <div key={asset.id} className="asset-item">
              <div className="asset-icon">
                {asset.market === 'TW' ? <TrendingUp size={20} /> : asset.market === 'US' ? <TrendingUp size={20} /> : <Wallet size={20} />}
              </div>
              <div className="asset-info">
                <p className="asset-name">{asset.name}</p>
                <p className="asset-symbol">{asset.symbol}</p>
              </div>
              <div className="asset-market">
                <p className="asset-price">${((asset.currentPrice || 0) * asset.quantity).toLocaleString()}</p>
                <p className={`asset-change ${(asset.currentPrice || 0) >= asset.cost ? 'positive' : 'negative'}`}>
                  {(((asset.currentPrice || 0) - asset.cost) / asset.cost * 100).toFixed(1)}%
                </p>
              </div>
              <ChevronRight size={16} color="var(--text-muted)" />
            </div>
          ))}
        </div>
      </section>

      {/* Tab Bar (for Mobile) */}
      <nav className="tab-bar">
        <div className="tab-item active"><TrendingUp size={20} /><span>Assets</span></div>
        <div className="tab-item"><PieChart size={20} /><span>Stats</span></div>
        <div className="tab-item"><Wallet size={20} /><span>Wallets</span></div>
      </nav>
    </div>
  );
}

export default App;
