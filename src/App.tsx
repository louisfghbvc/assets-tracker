import { useState, useEffect } from "react";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  PieChart,
  RefreshCw,
  Plus,
  ChevronRight,
  TrendingUp as ProfitIcon,
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

function App() {
  const [totalBalance, setTotalBalance] = useState(128450.65);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const assets: Asset[] = [
    { id: '1', name: '台積電', symbol: '2330.TW', value: 45200, change: 2.4, type: 'TW' },
    { id: '2', name: 'Apple Inc.', symbol: 'AAPL', value: 32150, change: -1.2, type: 'US' },
    { id: '3', name: 'Bitcoin', symbol: 'BTC', value: 51100.65, change: 5.7, type: 'Crypto' },
  ];

  const handleRefresh = () => {
    setIsRefreshing(true);
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
          <button className="refresh-btn" onClick={handleRefresh}>
            <RefreshCw size={18} className={isRefreshing ? "spin" : ""} />
          </button>
        </div>

        <div className="balance-section">
          <p className="balance-label">Total Balance</p>
          <h1 className="balance-amount">
            ${totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </h1>
          <div className="balance-stat">
            <span className="stat-value positive">+$2,450.20 (1.9%)</span>
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
            <p className="stat-card-value">$45.2k</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon us"><ArrowUpRight size={16} /></div>
          <div>
            <p className="stat-card-label">US Stocks</p>
            <p className="stat-card-value">$32.1k</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon crypto"><ArrowUpRight size={16} /></div>
          <div>
            <p className="stat-card-label">Crypto</p>
            <p className="stat-card-value">$51.1k</p>
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
          {assets.map((asset) => (
            <div key={asset.id} className="asset-item">
              <div className="asset-icon">
                {asset.type === 'TW' ? <TrendingUp size={20} /> : asset.type === 'US' ? <TrendingUp size={20} /> : <Wallet size={20} />}
              </div>
              <div className="asset-info">
                <p className="asset-name">{asset.name}</p>
                <p className="asset-symbol">{asset.symbol}</p>
              </div>
              <div className="asset-market">
                <p className="asset-price">${asset.value.toLocaleString()}</p>
                <p className={`asset-change ${asset.change > 0 ? 'positive' : 'negative'}`}>
                  {asset.change > 0 ? '+' : ''}{asset.change}%
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
