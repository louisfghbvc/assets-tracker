# Design: Add Asset Logos to List Items

## Component Structure

### new Component: `AssetLogo`
A wrapper component that attempts to load a logo image from a CDN based on the asset's symbol and market.
- **Props**: `symbol: string`, `market: string`, `fallbackIcon: ReactNode`.
- **Logic**:
  - If `market === 'TW'`, URL = `https://assets.parqet.com/logos/symbols/${symbol}.TW`
  - If `market === 'US'`, URL = `https://assets.parqet.com/logos/symbols/${symbol}`
  - If `market === 'Crypto'`, URL = `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${symbol.split('-')[0].toLowerCase()}.png`
- **State**: `imageError: boolean`.
- **Render**: If `imageError` is true or no URL is generated, render `fallbackIcon`. Otherwise, render `<img src={url} onError={() => setImageError(true)} />`.

## Styling
- The logo should have a subtle background if it's transparent.
- Standard size: `32px x 32px` or matching the current `asset-icon` container.
- Border radius: `50%` or `12px` (matching the current design's rounded corners).
- Ensure logos look good in both dark and light modes (usually dark mode is fine with most financial logos).

## Fallbacks
- If an image fails to load (404), the system MUST gracefully switch back to the original Lucide icon.
- This ensures that less common assets don't show a broken image.
