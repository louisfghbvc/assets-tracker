export interface PriceResult {
    symbol: string;
    price: number;
}

export interface CandleData {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
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
        // Helper function to fetch with timeout
        const fetchWithTimeout = async (url: string, timeoutMs = 5000): Promise<Response> => {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), timeoutMs);
            try {
                const response = await fetch(url, { signal: controller.signal });
                clearTimeout(timeout);
                return response;
            } catch (error) {
                clearTimeout(timeout);
                throw error;
            }
        };

        // Updated proxy list with more reliable options
        const proxies = [
            // Try direct fetch first (works for some APIs)
            "",
            // Cloudflare CORS proxy
            "https://api.codetabs.com/v1/proxy?quest=",
            // Backup proxies
            "https://corsproxy.io/?",
            "https://api.allorigins.win/raw?url="
        ];

        const fetchSinglePrice = async (symbol: string): Promise<PriceResult | null> => {
            const sanitized = symbol.trim().split(/\s+/)[0];

            // Filter out empty or invalid symbols
            if (!sanitized || sanitized === '.TW' || sanitized === '.TWO' || sanitized.length === 0) {
                console.warn(`⚠️ Skipping invalid symbol: "${symbol}"`);
                return null;
            }

            if (sanitized === 'USD' || sanitized === 'USD-USD' || sanitized === 'TWD') {
                return { symbol, price: 1 };
            }

            const timestamp = Date.now();
            const yahooSymbol = sanitized === 'BTC' ? 'BTC-USD' : sanitized === 'ETH' ? 'ETH-USD' : sanitized === 'SOL' ? 'SOL-USD' : sanitized;

            const targetUrl = sanitized.endsWith(".TW")
                ? `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=tse_${sanitized.replace(".TW", "")}.tw&json=1&_=${timestamp}`
                : `https://query2.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1m&range=1d&_=${timestamp}`;

            // Try each proxy
            for (let i = 0; i < proxies.length; i++) {
                const proxy = proxies[i];
                const fullUrl = proxy ? `${proxy}${encodeURIComponent(targetUrl)}` : targetUrl;

                try {
                    const res = await fetchWithTimeout(fullUrl);
                    if (!res.ok) {
                        continue;
                    }

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
                                console.log(`✓ ${symbol}: $${price}`);
                                return { symbol, price };
                            }
                        }
                    } else {
                        const price = json.chart?.result?.[0]?.meta?.regularMarketPrice;
                        if (price) {
                            console.log(`✓ ${symbol}: $${price}`);
                            return { symbol, price };
                        }
                    }
                } catch (error: any) {
                    continue;
                }
            }

            // Fallback for TWSE OTC stocks
            if (sanitized.endsWith(".TW")) {
                const code = sanitized.replace(".TW", "");
                const otcUrl = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=otc_${code}.tw&json=1&_=${timestamp}`;

                for (let i = 0; i < proxies.length; i++) {
                    const proxy = proxies[i];
                    const fullUrl = proxy ? `${proxy}${encodeURIComponent(otcUrl)}` : otcUrl;

                    try {
                        const res = await fetchWithTimeout(fullUrl);
                        if (!res.ok) continue;

                        let text = await res.text();
                        let json = JSON.parse(text);
                        if (json.contents) json = JSON.parse(json.contents);
                        if (json.msgArray && json.msgArray[0]) {
                            const msg = json.msgArray[0];
                            const price = parseFloat(msg.z && msg.z !== "-" ? msg.z : (msg.b?.split('_')[0] || msg.y)) || 0;
                            if (price > 0) {
                                console.log(`✓ ${symbol} (OTC): $${price}`);
                                return { symbol, price };
                            }
                        }
                    } catch {
                        continue;
                    }
                }
            }

            console.error(`✗ Failed to fetch: ${symbol}`);
            return null;
        };

        // Fetch all prices in parallel with a concurrency limit
        const BATCH_SIZE = 5; // Fetch 5 at a time to avoid overwhelming proxies
        const results: PriceResult[] = [];

        for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
            const batch = symbols.slice(i, i + BATCH_SIZE);
            const batchResults = await Promise.all(batch.map(fetchSinglePrice));
            results.push(...batchResults.filter((r): r is PriceResult => r !== null));
        }

        return results;
    },

    async fetchHistory(symbol: string, range: string = '1mo', interval: string = '1d'): Promise<CandleData[]> {
        try {
            if (!(window as any).__TAURI_INTERNALS__) {
                return await this.fetchHistoryWeb(symbol, range, interval);
            } else {
                const { invoke } = await import("@tauri-apps/api/core");
                return await invoke("fetch_history", { symbol, range, interval });
            }
        } catch (e: any) {
            console.error("History fetch failed:", e);
            throw e; // Throw so UI can capture message
        }
    },

    async fetchHistoryWeb(symbol: string, range: string, interval: string): Promise<CandleData[]> {
        const sanitized = symbol.trim().split(/\s+/)[0];
        const yahooSymbol = sanitized === 'BTC' ? 'BTC-USD' : sanitized === 'ETH' ? 'ETH-USD' : sanitized === 'SOL' ? 'SOL-USD' : sanitized;
        const targetUrl = `https://query2.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=${interval}&range=${range}`;

        const fetchWithTimeout = async (url: string, timeoutMs = 10000): Promise<Response> => {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), timeoutMs);
            try {
                const response = await fetch(url, { signal: controller.signal });
                clearTimeout(timeout);
                return response;
            } catch (error) {
                clearTimeout(timeout);
                throw error;
            }
        };

        const proxies = [
            "",
            "https://api.codetabs.com/v1/proxy?quest=",
            "https://corsproxy.io/?",
            "https://api.allorigins.win/raw?url="
        ];

        for (let i = 0; i < proxies.length; i++) {
            const proxy = proxies[i];
            const fullUrl = proxy ? `${proxy}${encodeURIComponent(targetUrl)}` : targetUrl;

            try {
                const res = await fetchWithTimeout(fullUrl);
                if (!res.ok) {
                    continue;
                }

                const json = await res.json();
                const result = json.chart?.result?.[0];
                if (!result) continue;

                const ts = result.timestamp;
                const indicators = result.indicators.quote[0];
                const history: CandleData[] = [];

                if (!ts) continue;

                for (let j = 0; j < ts.length; j++) {
                    if (indicators.open?.[j]) {
                        history.push({
                            time: ts[j],
                            open: indicators.open[j],
                            high: indicators.high[j],
                            low: indicators.low[j],
                            close: indicators.close[j],
                            volume: indicators.volume[j]
                        });
                    }
                }

                if (history.length > 0) {
                    return history;
                }
            } catch (e: any) {
                continue;
            }
        }

        throw new Error(`Unable to fetch chart data for ${symbol}. All proxies failed.`);
    }
};
