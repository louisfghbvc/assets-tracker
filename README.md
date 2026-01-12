# AssetTracker 📈

![Status](https://img.shields.io/badge/Status-Active%20Development-blue)
![Tauri](https://img.shields.io/badge/Framework-Tauri%20v2-orange)
![PWA](https://img.shields.io/badge/Web-PWA%20Supported-green)

這是一個個人化的跨平台資產追蹤系統，旨在解決分散在不同券商與錢包的資產管理痛點。透過 **Tauri** 建立高效能電腦版應用，並支援 **PWA (Progressive Web App)** 讓手機用戶能像原生 App 一樣安裝與使用。

## 🎯 關鍵功能 (Key Features)

*   **全方位資產概覽**：整合台股、美股、加密貨幣的持倉。
*   **跨平台支援**：一次開發，支援 Windows, macOS, Linux, Android, iOS 與 Web (PWA)。
*   **雲端同步備份**：整合 Google Sheets，支援手動「備份至雲端」與「從雲端還原」，實現跨平台資料同步。
*   **App-as-Source-of-Truth**：採用手動同步策略，確保使用者對資料狀態有完全的掌控，避免自動同步導致的資料衝突。
*   **即時效能優化**：針對行動裝置優化的毛玻璃質感介面，流暢度極佳。
*   **PWA 安裝**：無需透過 App Store，直接從瀏覽器「加入主畫面」即可使用。

## ☁️ 雲端同步設定 (Cloud Sync Setup)

本專案使用 Google Sheets 作為雲端資料庫。

### 1. 取得 Google Client ID
1.  前往 [Google Cloud Console](https://console.cloud.google.com/)。
2.  建立新專案並啟用 **Google Sheets API** 與 **Google Drive API**。
3.  在「憑證」頁面建立 **OAuth 2.0 用戶端 ID**（應用程式類型選擇「Web 應用程式」）。
4.  設定「已授權的重新導向 URI」（例如：`http://localhost:5173` 用於本地開發，或您的部署網址）。

### 2. 設定環境變數
在專案根目錄建立 `.env` 檔案並填入：
```env
VITE_GOOGLE_CLIENT_ID=您的_CLIENT_ID
```

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

*   **核心框架**: [Tauri v2](https://v2.tauri.app/)
*   **前端**: React + TypeScript + Vite + Vanilla CSS
*   **本地資料庫**: [Dexie.js](https://dexie.org/) (IndexedDB wrapper)
*   **雲端同步**: Google Sheets API v4 + Google Drive API v3
*   **PWA 支援**: `vite-plugin-pwa`
*   **UI 組件**: Lucide React + Recharts

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

## 🧪 測試 (Testing)

本專案使用 **Vitest** 與 **React Testing Library** 進行單元測試與元件測試。

### 執行測試
```bash
# 執行所有測試
npm run test:run

# 以監控模式執行測試
npm run test
```

### 測試結構
- **單元測試**: 位於 `src/services/__tests__/`，測試業務邏輯與 API 整合。
- **元件測試**: 位於 `src/components/__tests__/`，測試 UI 互動與渲染。
- **資料庫測試**: 位於 `src/db/__tests__/`，使用 `fake-indexeddb` 進行整合測試。

### 如何新增測試
1. 在目標程式碼目錄建立 `__tests__` 資料夾。
2. 建立 `[filename].test.ts` (邏輯) 或 `[filename].test.tsx` (元件)。
3. 使用 Vitest 的 `describe`, `it`, `expect` 寫法，元件測試需搭配 `render` 與 `screen`。

## 📂 專案結構 (Structure)

```text
assets-tracker/
├── src/                # 前端程式碼 (React + TS)
│   ├── components/     # UI 元件
│   ├── services/       # 同步與資料處理服務
│   ├── db/             # Dexie 資料庫定義
│   └── ...
├── src-tauri/          # 後端程式碼 (Rust/Mobile Config)
├── public/             # 靜態資源
└── index.html          # 入口檔案
```
