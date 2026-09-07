import { fetchViaProxy } from './proxy';

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

const BENCHMARK_CACHE_TTL_MS = 60 * 60 * 1000;

export function parseTwsePrice(msg: any): number {
    if (!msg) return 0;
    const parseField = (val: any): number => {
        if (typeof val === 'number' && !isNaN(val) && val > 0) return val;
        if (typeof val === 'string') {
            const trimmed = val.trim();
            if (trimmed && trimmed !== '-') {
                const first = trimmed.split('_')[0].trim();
                if (first && first !== '-') {
                    const p = parseFloat(first);
                    if (!isNaN(p) && p > 0) return p;
                }
            }
        }
        return 0;
    };

    return parseField(msg.z) || parseField(msg.b) || parseField(msg.a) || parseField(msg.y) || 0;
}

export const priceService = {
    async fetchExchangeRate(): Promise<number> {
        try {
            if (!(window as any).__TAURI_INTERNALS__) {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 5000);
                try {
                    const res = await fetch("https://open.er-api.com/v6/latest/USD", { signal: controller.signal });
                    clearTimeout(timeout);
                    const data = await res.json();
                    return data.rates?.TWD || 32.5;
                } catch {
                    clearTimeout(timeout);
                    return 32.5;
                }
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
        if (symbols.length === 0) return [];

        // Helper function to fetch with timeout (for fallback proxies)
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

        // Fallback proxy list (used if worker fails or is not configured)
        const fallbackProxies = [
            "https://api.codetabs.com/v1/proxy?quest=",
            "https://api.allorigins.win/raw?url="
        ];

        const fetchJsonFromUrl = async (targetUrl: string, timeoutMs = 5000): Promise<any> => {
            // Try Cloudflare Worker first
            const workerResponse = await fetchViaProxy(targetUrl, timeoutMs);
            if (workerResponse) {
                try {
                    const text = await workerResponse.text();
                    let json: any;
                    try {
                        json = JSON.parse(text);
                        if (json && json.contents) {
                            try { json = JSON.parse(json.contents); } catch {}
                        }
                        if (json && !json.error && !json.finance?.error && !json.chart?.error && !json.quoteResponse?.error) {
                            return json;
                        }
                    } catch {}
                } catch {}
            }

            // Try fallback proxies
            for (let i = 0; i < fallbackProxies.length; i++) {
                const proxy = fallbackProxies[i];
                const fullUrl = proxy + encodeURIComponent(targetUrl);
                try {
                    const res = await fetchWithTimeout(fullUrl, timeoutMs);
                    if (!res.ok) continue;

                    const text = await res.text();
                    if (text.includes('Too many requests') || text.includes('rate limit')) {
                        continue;
                    }

                    let json: any;
                    try {
                        json = JSON.parse(text);
                        if (json && json.contents) {
                            try { json = JSON.parse(json.contents); } catch {}
                        }
                        if (json && !json.error && !json.finance?.error && !json.chart?.error && !json.quoteResponse?.error) {
                            return json;
                        }
                    } catch {
                        continue;
                    }
                } catch {
                    continue;
                }
            }
            return null;
        };

        const resultsMap = new Map<string, number>();
        const twItems: { original: string; sanitized: string; code: string }[] = [];
        const usCryptoItems: { original: string; sanitized: string; yahoo: string }[] = [];

        for (const symbol of symbols) {
            const sanitized = symbol.trim().split(/\s+/)[0];
            const upper = sanitized.toUpperCase();
            if (!upper || upper === '.TW' || upper === '.TWO') {
                console.warn(`⚠️ Skipping invalid symbol: "${symbol}"`);
                continue;
            }

            if (upper === 'USD' || upper === 'USD-USD' || upper === 'TWD') {
                resultsMap.set(symbol, 1);
                continue;
            }

            if (upper.endsWith('.TW') || upper.endsWith('.TWO')) {
                const code = upper.replace(/\.TW(O)?$/i, '');
                twItems.push({ original: symbol, sanitized, code });
            } else {
                const yahoo = upper === 'BTC' ? 'BTC-USD' : upper === 'ETH' ? 'ETH-USD' : upper === 'SOL' ? 'SOL-USD' : upper;
                usCryptoItems.push({ original: symbol, sanitized, yahoo });
            }
        }

        const timestamp = Date.now();

        // 1. Fetch Taiwan stocks concurrently in batches with TSE & OTC combined
        const fetchTaiwanStocks = async () => {
            if (twItems.length === 0) return;

            const BATCH_SIZE = 20;
            const batches: typeof twItems[] = [];
            for (let i = 0; i < twItems.length; i += BATCH_SIZE) {
                batches.push(twItems.slice(i, i + BATCH_SIZE));
            }

            await Promise.all(batches.map(async batch => {
                const uniqueCodes = Array.from(new Set(batch.map(item => item.code)));
                const exCh = uniqueCodes.map(code => `tse_${code}.tw|otc_${code}.tw`).join('|');
                const targetUrl = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=${exCh}&json=1&_=${timestamp}`;

                const json = await fetchJsonFromUrl(targetUrl);
                if (json && Array.isArray(json.msgArray)) {
                    for (const msg of json.msgArray) {
                        const rawC = msg.c != null ? String(msg.c).trim() : '';
                        const rawAt = msg['@'] != null ? String(msg['@']).trim().split('.')[0] : '';
                        const rawCh = msg.ch != null ? String(msg.ch).trim().split('.')[0] : '';
                        const code = (rawC || rawAt || rawCh).toUpperCase();
                        const price = parseTwsePrice(msg);

                        if (price > 0) {
                            for (const item of batch) {
                                if (item.code === code) {
                                    resultsMap.set(item.original, price);
                                }
                            }
                            if (batch.length === 1 && !resultsMap.has(batch[0].original)) {
                                resultsMap.set(batch[0].original, price);
                            }
                        }
                    }
                }
            }));

            // Concurrent fallback for any unresolved Taiwan stocks
            const missing = twItems.filter(item => !resultsMap.has(item.original));
            if (missing.length > 0) {
                await Promise.all(missing.map(async item => {
                    const tseUrl = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=tse_${item.code}.tw&json=1&_=${timestamp}`;
                    const otcUrl = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=otc_${item.code}.tw&json=1&_=${timestamp}`;

                    const [tseJson, otcJson] = await Promise.all([
                        fetchJsonFromUrl(tseUrl),
                        fetchJsonFromUrl(otcUrl)
                    ]);

                    const getValidPrice = (arr: any) => Array.isArray(arr) ? arr.map(parseTwsePrice).find((p: number) => p > 0) || 0 : 0;
                    const price = getValidPrice(tseJson?.msgArray) || getValidPrice(otcJson?.msgArray);
                    if (price > 0) {
                        resultsMap.set(item.original, price);
                    }
                }));
            }
        };

        // 2. Fetch US stocks & Crypto assets concurrently using lightweight batch quote queries
        const fetchUsCryptoStocks = async () => {
            if (usCryptoItems.length === 0) return;

            const BATCH_SIZE = 30;
            const batches: typeof usCryptoItems[] = [];
            for (let i = 0; i < usCryptoItems.length; i += BATCH_SIZE) {
                batches.push(usCryptoItems.slice(i, i + BATCH_SIZE));
            }

            await Promise.all(batches.map(async batch => {
                const uniqueSymbols = Array.from(new Set(batch.map(b => b.yahoo)));
                const symbolsParam = uniqueSymbols.join(',');
                const batchQuoteUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbolsParam}&_=${timestamp}`;

                const json = await fetchJsonFromUrl(batchQuoteUrl);

                if (json) {
                    // Check quoteResponse (multi-symbol quote format)
                    if (json.quoteResponse && Array.isArray(json.quoteResponse.result)) {
                        for (const quote of json.quoteResponse.result) {
                            const sym = quote.symbol?.toUpperCase();
                            const price = [quote.regularMarketPrice, quote.postMarketPrice, quote.preMarketPrice, quote.previousClose]
                                .find(p => typeof p === 'number' && !isNaN(p) && p > 0);
                            if (typeof price === 'number' && price > 0) {
                                for (const b of batch) {
                                    if (b.yahoo.toUpperCase() === sym) {
                                        resultsMap.set(b.original, price);
                                    }
                                }
                            }
                        }
                    }

                    // Also check chart.result (format returned by mock or chart endpoints)
                    if (Array.isArray(json.chart?.result)) {
                        for (const chartItem of json.chart.result) {
                            const chartSym = chartItem?.meta?.symbol?.toUpperCase();
                            const meta = chartItem?.meta;
                            let chartPrice = (typeof meta?.regularMarketPrice === 'number' && meta.regularMarketPrice > 0)
                                ? meta.regularMarketPrice
                                : ((typeof meta?.chartPreviousClose === 'number' && meta.chartPreviousClose > 0)
                                    ? meta.chartPreviousClose
                                    : undefined);
                            if (typeof chartPrice !== 'number' || chartPrice <= 0) {
                                const closes = chartItem?.indicators?.quote?.[0]?.close;
                                if (Array.isArray(closes)) {
                                    const lastClose = [...closes].reverse().find((c: any) => typeof c === 'number' && c > 0);
                                    if (typeof lastClose === 'number') chartPrice = lastClose;
                                }
                            }
                            if (typeof chartPrice === 'number' && chartPrice > 0) {
                                for (const b of batch) {
                                    if (chartSym && b.yahoo.toUpperCase() === chartSym) {
                                        resultsMap.set(b.original, chartPrice);
                                    } else if (!chartSym && batch.length === 1) {
                                        resultsMap.set(b.original, chartPrice);
                                    }
                                }
                            }
                        }
                    }
                }
            }));

            // Concurrent fallback for any unresolved US / Crypto symbols
            const missing = usCryptoItems.filter(item => !resultsMap.has(item.original));
            if (missing.length > 0) {
                await Promise.all(missing.map(async item => {
                    const chartUrl = `https://query2.finance.yahoo.com/v8/finance/chart/${item.yahoo}?interval=1d&range=1d&_=${timestamp}`;
                    const json = await fetchJsonFromUrl(chartUrl);
                    const meta = json?.chart?.result?.[0]?.meta;
                    let price = (typeof meta?.regularMarketPrice === 'number' && meta.regularMarketPrice > 0)
                        ? meta.regularMarketPrice
                        : ((typeof meta?.chartPreviousClose === 'number' && meta.chartPreviousClose > 0)
                            ? meta.chartPreviousClose
                            : undefined);
                    if (typeof price !== 'number' || price <= 0) {
                        const closes = json?.chart?.result?.[0]?.indicators?.quote?.[0]?.close;
                        if (Array.isArray(closes)) {
                            const lastClose = [...closes].reverse().find((c: any) => typeof c === 'number' && c > 0);
                            if (typeof lastClose === 'number') price = lastClose;
                        }
                    }
                    if (typeof price === 'number' && price > 0) {
                        resultsMap.set(item.original, price);
                    }
                }));
            }
        };

        // Fetch both categories concurrently
        await Promise.all([fetchTaiwanStocks(), fetchUsCryptoStocks()]);

        // Preserve input symbol ordering
        const results: PriceResult[] = [];
        for (const sym of symbols) {
            const price = resultsMap.get(sym);
            if (price !== undefined) {
                results.push({ symbol: sym, price });
            }
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

        // Try Cloudflare Worker first
        const workerResponse = await fetchViaProxy(targetUrl);
        if (workerResponse) {
            try {
                const json = await workerResponse.json();
                const result = json.chart?.result?.[0];
                if (result) {
                    const ts = result.timestamp;
                    const indicators = result.indicators.quote[0];
                    const history: CandleData[] = [];

                    if (ts) {
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
                            console.log(`✓ History for ${symbol} fetched via worker`);
                            return history;
                        }
                    }
                }
            } catch {
                // fall through to fallback proxies
            }
        }

        const fallbackProxies = [
            "https://api.codetabs.com/v1/proxy?quest=",
            "https://api.allorigins.win/raw?url=",
            "https://corsproxy.io/?"
        ];

        for (let i = 0; i < fallbackProxies.length; i++) {
            const proxy = fallbackProxies[i];
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
                    console.log(`✓ History for ${symbol} fetched via fallback proxy ${i}`);
                    return history;
                }
            } catch (e: any) {
                continue;
            }
        }

        return [];
    },

    // Module-level cache for benchmark prices (clears on page reload)
    _benchmarkCache: null as { data: Record<string, { startPrice: number; currentPrice: number }>; fetchedAt: number } | null,

    async fetchBenchmarkPrice(symbol: string, startDateMs: number): Promise<{ startPrice: number; currentPrice: number } | null> {
        const ALLOWED_BENCHMARK_SYMBOLS = new Set(['^TWII', 'SPY']);
        if (!ALLOWED_BENCHMARK_SYMBOLS.has(symbol)) return null;

        const cacheKey = `${symbol}:${Math.floor(startDateMs / BENCHMARK_CACHE_TTL_MS)}`; // key by hour bucket
        const now = Date.now();

        if (this._benchmarkCache && now - this._benchmarkCache.fetchedAt < BENCHMARK_CACHE_TTL_MS) {
            const cached = this._benchmarkCache.data[cacheKey];
            if (cached) return cached;
        }

        const fallbackProxies = [
            "https://api.codetabs.com/v1/proxy?quest=",
            "https://api.allorigins.win/raw?url="
        ];

        // Narrow 7-day window around startDate to get the opening price
        const period1 = Math.floor(startDateMs / 1000);
        const period2 = Math.floor(startDateMs / 1000) + 7 * 86400;
        const startUrl = `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&period1=${period1}&period2=${period2}`;
        const currentUrl = `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1m&range=1d`;

        const fetchJson = async (url: string): Promise<any> => {
            const workerRes = await fetchViaProxy(url);
            if (workerRes) {
                try {
                    const text = await workerRes.text();
                    try { return JSON.parse(text); } catch { /* fall through */ }
                } catch { /* fall through */ }
            }
            for (const proxy of fallbackProxies) {
                try {
                    const res = await fetch(proxy + encodeURIComponent(url));
                    if (!res.ok) continue;
                    const text = await res.text();
                    try {
                        const parsed = JSON.parse(text);
                        return parsed.contents ? JSON.parse(parsed.contents) : parsed;
                    } catch { continue; }
                } catch { continue; }
            }
            return null;
        };

        try {
            const [startJson, currentJson] = await Promise.all([fetchJson(startUrl), fetchJson(currentUrl)]);

            const startCloses = startJson?.chart?.result?.[0]?.indicators?.quote?.[0]?.close;
            const startPrice = startCloses?.find((v: number | null) => v != null && v > 0) ?? null;

            const currentPrice = currentJson?.chart?.result?.[0]?.meta?.regularMarketPrice ?? null;

            if (startPrice == null || currentPrice == null) return null;

            const result = { startPrice, currentPrice };

            if (!this._benchmarkCache || now - this._benchmarkCache.fetchedAt >= BENCHMARK_CACHE_TTL_MS) {
                this._benchmarkCache = { data: {}, fetchedAt: now };
            }
            this._benchmarkCache.data[cacheKey] = result;

            return result;
        } catch (e) {
            console.error('Benchmark fetch failed:', e);
            return null;
        }
    }
};
