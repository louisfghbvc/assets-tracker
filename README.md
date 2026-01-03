# Personal Assets Tracker 📈

![Status](https://img.shields.io/badge/Status-Active%20Development-blue)
![Tauri](https://img.shields.io/badge/Framework-Tauri%20v2-orange)
![Rust](https://img.shields.io/badge/Backend-Rust-brown)
![React](https://img.shields.io/badge/Frontend-React-blue)
![Database](https://img.shields.io/badge/Database-Google%20Sheets-green)

這是一個個人化的跨平台資產追蹤系統，旨在解決分散在不同券商與錢包的資產管理痛點。透過 **Tauri** 建立的高效能桌面應用程式，自動抓取現價並以 **Google Sheets** 作為後端資料庫，實現跨市場（台股、美股、加密貨幣）的資產總覽。

## 🎯 專案目標 (Goals)

* **單一事實來源 (SSOT)**：將台股 (TWSE)、美股 (Nasdaq/NYSE)、加密貨幣 (Crypto) 的持倉整合在同一個儀表板。
* **自動化更新**：透過 API 自動獲取最新市價，計算即時淨值。
* **低成本資料庫**：利用 Google Sheets API 進行資料存取，方便隨時透過電腦版應用或手機手動調整。

## 🛠 技術架構 (Architecture)

* **核心框架**: [Tauri v2](https://v2.tauri.app/)
* **前端**: React + TypeScript + Vite
* **後端**: Rust
* **資料庫**: Google Sheets (via Google Sheets API v4)
* **資料來源**:
    * 台股: `yfinance` 或專屬 API 整合
    * 美股: `yfinance`
    * 加密貨幣: `ccxt` 或 CoinGecko API

## 📂 專案結構 (Structure)

```text
assets-tracker/
├── src/                # 前端程式碼 (React + TS)
│   ├── assets/         # 靜態資源
│   ├── components/     # UI 元件
│   └── main.tsx        # 前端進入點
├── src-tauri/          # 後端程式碼 (Rust)
│   ├── src/            # Rust 邏輯與 API 整合
│   ├── Cargo.toml      # Rust 依賴管理
│   └── tauri.conf.json # Tauri 配置
├── public/             # 公用靜態檔案
├── index.html          # 入口 HTML
├── package.json        # 專案依賴與腳本
└── README.md
```

## 🚀 快速開始 (Quick Start)

### 準備工作
- 安裝 [Rust](https://www.rust-lang.org/tools/install)
- 安裝 [Node.js](https://nodejs.org/)
- 暸解 [Tauri 必備依賴](https://v2.tauri.app/start/prerequisites/)

### 開發模式
```bash
npm install
npm run tauri dev
```

### 建立產出
```bash
npm run tauri build
```
