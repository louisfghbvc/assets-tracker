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

## 🌐 部署 (Deployment)

### GitHub Pages (推薦網頁版)

本專案可直接部署到 GitHub Pages，但為了達到 **100% 可靠的價格抓取**，建議部署自己的 Cloudflare Worker 代理。

#### 為什麼需要 Worker 代理？

| 項目 | 無 Worker | 有 Worker |
|------|----------|----------|
| 價格抓取成功率 | ~85-95% | **100%** |
| 交易所 API (Pionex/BitoPro) | ❌ 不支援 | ✅ 完整支援 |
| 費用 | 免費 | **免費** (Cloudflare 免費額度) |
| 速度 | 較慢 (受限免費代理) | 快速 (全球 CDN) |

#### 部署步驟

1. **設定 Google OAuth** (見上方「雲端同步設定」)

2. **部署 Cloudflare Worker** (可選但強烈建議):
   ```bash
   # 詳細步驟見 docs/cloudflare-worker-setup.md
   cd workers/cors-proxy
   wrangler deploy
   ```

3. **設定 GitHub Secrets**:
   - 前往 Repository Settings → Secrets and variables → Actions
   - 新增以下 secrets:
     - `VITE_GOOGLE_CLIENT_ID`: 你的 Google OAuth Client ID
     - `VITE_CORS_PROXY_URL`: Worker URL (如: `https://xxx.workers.dev/proxy`)

4. **觸發部署**: Push 到 main 分支，GitHub Actions 會自動部署

#### 沒有 Worker 的替代方案

如果不想部署 Worker，應用程式會自動降級使用免費公共代理，但會有以下限制：
- 價格抓取可能偶爾失敗 (~85-95% 成功率)
- 交易所 API 無法在網頁版使用
- 需要使用 Tauri 桌面版才能獲得完整功能

**詳細設定指南**: [docs/cloudflare-worker-setup.md](./docs/cloudflare-worker-setup.md)

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

## 📈 資產趨勢追蹤 (Asset Trend Tracking)

本專案支援自動化資產紀錄趨勢圖，讓您可以視覺化地查看資產變化。

### 核心機制
*   **自動快照**：每次開啟 App 或點擊「更新市價」時，系統會自動儲存一份當下的資產總額。
*   **趨勢圖表**：使用面積趨勢圖 (Area Chart) 展示資產隨時間的波動。
*   **雲端同步**：趨勢紀錄會自動備份至 Google Sheets 的 `History` 分頁。

---

## 🤖 全自動化紀錄設定 (Google Apps Script)

為了讓系統在您**不開啟 App** 的情況下也能每天自動紀錄資產，我們利用 Google 試算表內建的腳本功能。這對多使用者（如家人）特別方便。

### 設定步驟 (100% 免費且自動)

1.  **開啟試算表腳本**：
    *   打開您的 Google 試算表 `AssetsTracker_DB`。
    *   點擊選單列的 **「擴充功能」 (Extensions)** → **「Apps Script」**。
    *   刪除視窗中原有的所有程式碼。

2.  **貼上自動化腳本**：
    *   將以下程式碼貼入編輯器中並儲存：

```javascript
/** 每日資產趨勢自動紀錄腳本 (動態報價版) **/
function recordDailySnapshot() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const portfolioSheet = ss.getSheetByName('Portfolio');
  let historySheet = ss.getSheetByName('History');

  if (!portfolioSheet) return;
  if (!historySheet) {
    historySheet = ss.insertSheet('History');
    historySheet.appendRow(['Date', 'TotalValue', 'Currency', 'Notes']);
  }

  // --- 1. 動態抓取實時匯率 ---
  let exchangeRate = 32.5; 
  try {
    const response = UrlFetchApp.fetch("https://open.er-api.com/v6/latest/USD");
    const json = JSON.parse(response.getContentText());
    if (json && json.rates && json.rates.TWD) {
      exchangeRate = json.rates.TWD;
    } else {
      const gfRate = GoogleFinance_Single("CURRENCY:USDTWD");
      if (gfRate) exchangeRate = gfRate;
    }
  } catch(e) {}

  const data = portfolioSheet.getDataRange().getValues();
  if (data.length <= 1) return;

  // --- 2. 建立「隱形計算機」來批量抓取 Google Finance 價格 ---
  let calcSheet = ss.getSheetByName('Temp_Calc');
  if (calcSheet) ss.deleteSheet(calcSheet);
  calcSheet = ss.insertSheet('Temp_Calc');
  calcSheet.hideSheet();

  const symbols = [];
  for (let i = 1; i < data.length; i++) {
    const symbol = data[i][1];
    const market = data[i][4];
    if (!symbol) { symbols.push(""); continue; }

    if (market === 'TW') {
      const code = symbol.replace(".TW", "").replace(".TWO", "");
      if (code === "TWD") {
        symbols.push("1"); // 台幣現金直接給 1
      } else {
        symbols.push('IFERROR(GOOGLEFINANCE("TPE:' + code + '"), GOOGLEFINANCE("TWO:' + code + '"))');
      }
    } else if (market === 'US') {
      symbols.push('GOOGLEFINANCE("' + symbol + '")');
    } else if (market === 'Crypto') {
      const crypto = symbol.split('-')[0].toUpperCase();
      if (crypto === "USDT" || crypto === "USDC" || crypto === "USD") {
        symbols.push("1"); // 穩定幣直接給 1 (美金)
      } else {
        symbols.push('GOOGLEFINANCE("CURRENCY:' + crypto + 'USD")');
      }
    } else {
      symbols.push("");
    }
  }

  // 批量填入公式並讀取結果
  const formulas = symbols.map(s => {
    if (!s) return [""];
    return (s === "1") ? [1] : ["=" + s]; // 如果是 1 則直接填入數字，否則填入公式
  });
  calcSheet.getRange(1, 1, formulas.length, 1).setFormulas(formulas);
  SpreadsheetApp.flush(); // 強迫 Google 計算
  const prices = calcSheet.getRange(1, 1, formulas.length, 1).getValues();
  ss.deleteSheet(calcSheet); // 刪除臨時分頁

  // --- 3. 逐行累加總價值 ---
  let totalValueTwd = 0;
  for (let i = 1; i < data.length; i++) {
    const market = data[i][4];
    const qty = parseFloat(data[i][5]);
    let price = parseFloat(prices[i-1][0]);

    // 備案：如果抓不到價格，才使用手動輸入的成本
    if (!price || price <= 0) {
      price = parseFloat(data[i][6]) || 0;
    }

    const val = qty * price;
    totalValueTwd += (market === 'TW' ? val : val * exchangeRate);
  }

  // --- 4. 紀錄到 History (同一天自動覆蓋更新，但保護手動筆記) ---
  const today = Utilities.formatDate(new Date(), "GMT+8", "yyyy-MM-dd");
  const lastRow = historySheet.getLastRow();
  
  if (lastRow > 1) {
    const lastDate = Utilities.formatDate(historySheet.getRange(lastRow, 1).getValue(), "GMT+8", "yyyy-MM-dd");
    if (lastDate === today) {
      historySheet.getRange(lastRow, 2).setValue(totalValueTwd);
      
      const currentNote = historySheet.getRange(lastRow, 4).getValue();
      if (!currentNote || currentNote.indexOf("Auto-") === 0) {
        historySheet.getRange(lastRow, 4).setValue("Auto-updated at " + new Date().toLocaleTimeString());
      }
      return;
    }
  }
  historySheet.appendRow([today, totalValueTwd, "TWD", "Auto-snapshot"]);
}

/** 輔助用：單筆抓取匯率 **/
function GoogleFinance_Single(query) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.insertSheet('Temp_Single');
  sh.getRange('A1').setFormula('=GOOGLEFINANCE("' + query + '")');
  SpreadsheetApp.flush();
  const res = sh.getRange('A1').getValue();
  ss.deleteSheet(sh);
  return res;
}

```

3.  **設定定時執行 (鬧鐘)**：
    *   在視窗左側點擊 **「觸發條件」 (Triggers, 鬧鐘圖示)**。
    *   點擊 **「＋ 新增觸發條件」**。
    *   選擇 `recordDailySnapshot` -> `時間驅動` -> `日計時器` -> `晚上 11 點到 12 點`。
    *   儲存並完成 Google 帳號授權即可。

---

## 🛠 技術架構 (Architecture)

*   **核心框架**: [Tauri v2](https://v2.tauri.app/)
*   **前端**: React + TypeScript + Vite + Vanilla CSS
*   **本地資料庫**: [Dexie.js](https://dexie.org/) (IndexedDB wrapper)
*   **雲端同步**: Google Sheets API v4 + Google Drive API v3
*   **圖表庫**: [Lightweight Charts](https://tradingview.github.io/lightweight-charts/) (用於趨勢圖)
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
