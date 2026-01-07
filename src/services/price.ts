export interface PriceResult {
    symbol: string;
    price: number;
}

export const priceService = {
    async fetchExchangeRate(): Promise<number> {
        try {
            if (!(window as any).__TAURI_INTERNALS__) {
                const res = await fetch("https://open.er-api.com/v6/latest/USD");
                const data = await res.json();
                return data.rates?.TWD || 32.5;
            } else {
                const { invoke } = await import("@tauri-apps/api/core");
                return await invoke("fetch_exchange_rate");
            }
        } catch (e) {
            console.error("Exchange rate fetch failed:", e);
            return 32.5;
        }
    },

    async fetchPrices(symbols: string[]): Promise<PriceResult[]> {
        if (symbols.length === 0) return [];

        try {
            if (!(window as any).__TAURI_INTERNALS__) {
                return await this.fetchPricesWeb(symbols);
            } else {
                const { invoke } = await import("@tauri-apps/api/core");
                return await invoke("fetch_prices", { symbols });
            }
        } catch (e) {
            console.error("Price fetch failed:", e);
            return [];
        }
    },

    async fetchPricesWeb(symbols: string[]): Promise<PriceResult[]> {
        const results: PriceResult[] = [];
        const proxies = [
            "https://corsproxy.io/?",
            "https://api.allorigins.win/raw?url="
        ];

        for (const symbol of symbols) {
            const sanitized = symbol.trim().split(/\s+/)[0];
            if (sanitized === 'USD' || sanitized === 'USD-USD' || sanitized === 'TWD') {
                results.push({ symbol, price: 1 });
                continue;
            }
            const timestamp = Date.now();
            const yahooSymbol = sanitized === 'BTC' ? 'BTC-USD' : sanitized === 'ETH' ? 'ETH-USD' : sanitized === 'SOL' ? 'SOL-USD' : sanitized;

            const targetUrl = sanitized.endsWith(".TW")
                ? `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=tse_${sanitized.replace(".TW", "")}.tw&json=1&_=${timestamp}`
                : `https://query2.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1m&range=1d&_=${timestamp}`;

            let fetched = false;
            for (const proxy of proxies) {
                try {
                    const res = await fetch(`${proxy}${encodeURIComponent(targetUrl)}`);
                    if (!res.ok) continue;

                    const text = await res.text();
                    let json: any;
                    try {
                        json = JSON.parse(text);
                    } catch {
                        const wrapped = JSON.parse(text);
                        json = JSON.parse(wrapped.contents);
                    }

                    if (sanitized.endsWith(".TW")) {
                        if (json.msgArray && json.msgArray[0]) {
                            const msg = json.msgArray[0];
                            const price = parseFloat(msg.z && msg.z !== "-" ? msg.z : (msg.b?.split('_')[0] || msg.y)) || 0;
                            if (price > 0) {
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
                } catch {
                    continue;
                }
            }

            // Fallback for TWSE OTC
            if (!fetched && sanitized.endsWith(".TW")) {
                const code = sanitized.replace(".TW", "");
                const otcUrl = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=otc_${code}.tw&json=1&_=${timestamp}`;
                for (const proxy of proxies) {
                    try {
                        const res = await fetch(`${proxy}${encodeURIComponent(otcUrl)}`);
                        let text = await res.text();
                        let json = JSON.parse(text);
                        if (json.contents) json = JSON.parse(json.contents);
                        if (json.msgArray && json.msgArray[0]) {
                            const msg = json.msgArray[0];
                            const price = parseFloat(msg.z && msg.z !== "-" ? msg.z : (msg.b?.split('_')[0] || msg.y)) || 0;
                            if (price > 0) {
                                results.push({ symbol, price });
                                break;
                            }
                        }
                    } catch { continue; }
                }
            }
        }
        return results;
    }
};
