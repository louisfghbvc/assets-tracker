# Design: Complete Localization and Intuitive Language Toggle

## 1. Translation Keys Update
Add localized versions for market types:
- `en`: `twMarket: "TW Stocks"`, `usMarket: "US Stocks"`, `cryptoMarket: "Crypto"`
- `zh`: `twMarket: "台股"`, `usMarket: "美股"`, `cryptoMarket: "加密貨幣"`

## 2. Language Toggle Button Logic
Update the button in `App.tsx`:
```tsx
<button className="action-btn lang-btn active" onClick={toggleLanguage}>
  <span>{language === 'zh' ? '繁體中文' : 'English'}</span>
</button>
```
To make it even clearer, we could show both and highlight the active one, or just follow the user's specific request: "按鈕顯示中文, 頁面就是中文".

## 3. Modal Localization
In `AddAssetModal.tsx`:
- Replace `{m}` in the market selector with `{t(m.toLowerCase() + 'Market' as any)}`.
- Ensure placeholder numbers (0.00) are fine but labels are translated.

## 4. Toast and Sync Status
- Ensure `syncStatus` messages in `performUpload`, `handleCloudDownload`, and `handleRefresh` use the `t()` function.
