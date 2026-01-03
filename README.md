# AssetTracker 📈

![Status](https://img.shields.io/badge/Status-Active%20Development-blue)
![Tauri](https://img.shields.io/badge/Framework-Tauri%20v2-orange)
![PWA](https://img.shields.io/badge/Web-PWA%20Supported-green)

這是一個個人化的跨平台資產追蹤系統，旨在解決分散在不同券商與錢包的資產管理痛點。透過 **Tauri** 建立高效能電腦版應用，並支援 **PWA (Progressive Web App)** 讓手機用戶能像原生 App 一樣安裝與使用。

## 🎯 關鍵功能 (Key Features)

* **全方位資產概覽**：整合台股、美股、加密貨幣的持倉。
* **跨平台支援**：一次開發，支援 Windows, macOS, Linux, Android, iOS 與 Web (PWA)。
* **即時效能優化**：針對行動裝置優化的毛玻璃質感介面，流暢度極佳。
* **PWA 安裝**：無需透過 App Store，直接從瀏覽器「加入主畫面」即可使用。

## 📱 行動裝置安裝 (Mobile Installation)

由於本專案支援 PWA，建議直接使用此方式安裝，效能最為流暢：

### iOS (Safari)
1. 用 Safari 開啟應用網址。
2. 點擊下方的 **「分享」** 按鈕。
3. 選擇 **「加入主畫面」**。

### Android (Chrome)
1. 用 Chrome 開啟應用網址。
2. 點擊右上角選單或彈出的安裝提示。
3. 選擇 **「安裝應用程式」**。

## 🛠 技術架構 (Architecture)

* **核心框架**: [Tauri v2](https://v2.tauri.app/)
* **前端**: React + TypeScript + Vite + Vanilla CSS
* **PWA 支援**: `vite-plugin-pwa`
* **UI 組件**: Lucide React

## 🚀 開發與建置 (Development)

### 準備工作
- 安裝 [Rust](https://www.rust-lang.org/tools/install)
- 安裝 [Node.js](https://nodejs.org/)

### 電腦版開發
```bash
npm install
npm run tauri dev
```

### Android 開發
```bash
npm run android
```

### iOS 開發 (需 Xcode)
```bash
npm run ios
```

### Web 預覽 (PWA)
```bash
npm run build
npx vite preview --host
```

## 📂 專案結構 (Structure)

```text
assets-tracker/
├── src/                # 前端程式碼 (React + TS)
├── src-tauri/          # 後端程式碼 (Rust/Mobile Config)
├── public/             # 靜態資源 (包含 App 圖示)
└── index.html          # 入口檔案
```
