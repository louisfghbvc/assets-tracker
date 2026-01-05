import Fuse from 'fuse.js';

export interface SearchResult {
    symbol: string;
    name: string;
    market: 'TW' | 'US' | 'Crypto';
    type: 'stock' | 'crypto';
}

export const searchService = {
    async search(query: string, market: 'TW' | 'US' | 'Crypto'): Promise<SearchResult[]> {
        if (!query || query.length < 1) return [];

        try {
            let results: SearchResult[] = [];

            if (market === 'TW') {
                // For TW, combine TWSE (official) and Yahoo (Fuzzy backup)
                const [twseResults, yahooResults] = await Promise.all([
                    this.searchTW(query),
                    this.searchYahoo(query, 'TW')
                ]);
                results = [...twseResults, ...yahooResults];
            } else {
                results = await this.searchYahoo(query, market);
            }

            // Deduplicate by symbol
            const seen = new Set();
            const uniqueResults = results.filter(r => {
                if (seen.has(r.symbol)) return false;
                seen.add(r.symbol);
                return true;
            });

            // Perform Fuzzy Ranking on the client side
            const fuse = new Fuse(uniqueResults, {
                keys: ['symbol', 'name'],
                threshold: 0.4, // Adjust for fuzziness
                includeScore: true
            });

            const fuzzyResults = fuse.search(query);

            if (fuzzyResults.length > 0) {
                return fuzzyResults.map(r => r.item);
            }

            // If fuzzy search yields nothing but we have unique results, return them as is
            return uniqueResults.slice(0, 10);
        } catch (error) {
            console.error("Search failed:", error);
            return [];
        }
    },

    async searchTW(query: string): Promise<SearchResult[]> {
        const proxy = "https://corsproxy.io/?";
        const url = `https://www.twse.com.tw/zh/api/codeQuery?query=${encodeURIComponent(query)}`;

        try {
            const res = await fetch(`${proxy}${encodeURIComponent(url)}`);
            const data = await res.json();

            return (data.suggestions || []).map((s: string) => {
                const parts = s.trim().split(/\s+/);
                const symbolOnly = parts[0];
                const nameOnly = parts.slice(1).join(' ');

                return {
                    symbol: `${symbolOnly}.TW`,
                    name: nameOnly,
                    market: 'TW',
                    type: 'stock'
                };
            });
        } catch (e) {
            console.error("TWSE search failed:", e);
            return [];
        }
    },

    async searchYahoo(query: string, market: 'TW' | 'US' | 'Crypto'): Promise<SearchResult[]> {
        const proxy = "https://corsproxy.io/?";
        const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=15`;

        try {
            const res = await fetch(`${proxy}${encodeURIComponent(url)}`);
            const data = await res.json();

            return (data.quotes || [])
                .filter((q: any) => q.quoteType === 'EQUITY' || q.quoteType === 'CRYPTOCURRENCY' || q.quoteType === 'ETF')
                .map((q: any) => {
                    let type: 'stock' | 'crypto' = q.quoteType === 'CRYPTOCURRENCY' ? 'crypto' : 'stock';
                    let detectedMarket: 'TW' | 'US' | 'Crypto' = market;

                    if (q.symbol.endsWith('.TW')) detectedMarket = 'TW';
                    else if (type === 'crypto') detectedMarket = 'Crypto';
                    else detectedMarket = 'US';

                    return {
                        symbol: q.symbol,
                        name: q.shortname || q.longname || q.symbol,
                        market: detectedMarket,
                        type: type
                    };
                });
        } catch (e) {
            console.error("Yahoo search failed:", e);
            return [];
        }
    }
};
