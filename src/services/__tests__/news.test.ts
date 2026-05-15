import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchNews, fetchNewsBatch, invalidateNewsCache, timeAgo } from '../news';

vi.mock('../proxy', () => ({
    fetchViaProxy: vi.fn(),
}));

import { fetchViaProxy } from '../proxy';
const mockFetchViaProxy = fetchViaProxy as ReturnType<typeof vi.fn>;

function makeResponse(data: any) {
    return { json: async () => data } as Response;
}

function makeXMLResponse(xml: string) {
    return { text: async () => xml } as Response;
}

const sampleNews = [
    { title: 'Article A', publisher: 'Reuters', link: 'https://a.com/1', providerPublishTime: 1000 },
    { title: 'Article B', publisher: 'Bloomberg', link: 'https://b.com/2', providerPublishTime: 2000 },
];

const SAMPLE_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title>台積電股價突破1000元大關</title>
      <link>https://news.google.com/articles/abc123</link>
      <pubDate>Sun, 14 May 2026 14:30:00 GMT</pubDate>
      <source url="https://www.chinatimes.com">工商時報</source>
    </item>
    <item>
      <title>台積電法說會重點摘要</title>
      <link>https://news.google.com/articles/def456</link>
      <pubDate>Mon, 15 May 2026 10:00:00 GMT</pubDate>
      <source url="https://www.cnyes.com">鉅亨網</source>
    </item>
  </channel>
</rss>`;

const EMPTY_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel></channel></rss>`;

describe('fetchNews — Yahoo (EN) path', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        invalidateNewsCache();
    });

    it('cache miss — fetches and returns sorted NewsItem[]', async () => {
        mockFetchViaProxy.mockResolvedValue(makeResponse({ news: sampleNews }));
        const items = await fetchNews('NVDA');
        expect(items).toHaveLength(2);
        expect(items[0].providerPublishTime).toBeGreaterThan(items[1].providerPublishTime);
        expect(mockFetchViaProxy).toHaveBeenCalledTimes(1);
        expect(mockFetchViaProxy).toHaveBeenCalledWith(expect.stringContaining('q=NVDA'));
    });

    it('cache hit (fresh) — returns cached, no fetch', async () => {
        mockFetchViaProxy.mockResolvedValue(makeResponse({ news: sampleNews }));
        await fetchNews('NVDA');
        mockFetchViaProxy.mockClear();

        const items = await fetchNews('NVDA');
        expect(items).toHaveLength(2);
        expect(mockFetchViaProxy).not.toHaveBeenCalled();
    });

    it('cache hit (expired) — re-fetches', async () => {
        vi.useFakeTimers();
        try {
            mockFetchViaProxy.mockResolvedValue(makeResponse({ news: sampleNews }));
            await fetchNews('NVDA');

            vi.advanceTimersByTime(16 * 60 * 1000);
            mockFetchViaProxy.mockClear();

            await fetchNews('NVDA');
            expect(mockFetchViaProxy).toHaveBeenCalledTimes(1);
        } finally {
            vi.useRealTimers();
        }
    });

    it('US symbol NVDA — routes to Yahoo Finance', async () => {
        mockFetchViaProxy.mockResolvedValue(makeResponse({ news: [] }));
        await fetchNews('NVDA');
        expect(mockFetchViaProxy).toHaveBeenCalledWith(expect.stringContaining('query1.finance.yahoo.com'));
        expect(mockFetchViaProxy).toHaveBeenCalledWith(expect.stringContaining('q=NVDA'));
    });

    it('BRK-A — routes to Yahoo Finance (non-fiat dash, v0.6.0 regression)', async () => {
        mockFetchViaProxy.mockResolvedValue(makeResponse({ news: [] }));
        await fetchNews('BRK-A');
        expect(mockFetchViaProxy).toHaveBeenCalledWith(expect.stringContaining('query1.finance.yahoo.com'));
        expect(mockFetchViaProxy).toHaveBeenCalledWith(expect.stringContaining('q=BRK-A'));
    });

    it('proxy returns null — returns []', async () => {
        mockFetchViaProxy.mockResolvedValue(null);
        const items = await fetchNews('NVDA');
        expect(items).toEqual([]);
    });

    it('JSON SyntaxError — returns []', async () => {
        mockFetchViaProxy.mockResolvedValue({ json: async () => { throw new SyntaxError('bad json'); } } as any);
        const items = await fetchNews('NVDA');
        expect(items).toEqual([]);
    });

    it('shape guard: data.news not array — returns []', async () => {
        mockFetchViaProxy.mockResolvedValue(makeResponse({ news: null }));
        const items = await fetchNews('NVDA');
        expect(items).toEqual([]);
    });

    it('empty news array — returns []', async () => {
        mockFetchViaProxy.mockResolvedValue(makeResponse({ news: [] }));
        const items = await fetchNews('NVDA');
        expect(items).toEqual([]);
    });

    it('filters items with non-https links', async () => {
        const mixed = [
            { title: 'Safe', publisher: 'X', link: 'https://safe.com', providerPublishTime: 1 },
            { title: 'Unsafe', publisher: 'Y', link: 'http://unsafe.com', providerPublishTime: 2 },
            { title: 'Bad', publisher: 'Z', link: 'javascript:alert(1)', providerPublishTime: 3 },
        ];
        mockFetchViaProxy.mockResolvedValue(makeResponse({ news: mixed }));
        const items = await fetchNews('NVDA');
        expect(items).toHaveLength(1);
        expect(items[0].title).toBe('Safe');
    });
});

describe('fetchNews — Google News (ZH) path: routing', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        invalidateNewsCache();
    });

    it('TW symbol 2330.TW — routes to Google News with zh-TW locale', async () => {
        mockFetchViaProxy.mockResolvedValue(makeXMLResponse(EMPTY_RSS));
        await fetchNews('2330.TW');
        expect(mockFetchViaProxy).toHaveBeenCalledWith(expect.stringContaining('news.google.com/rss/search'));
        expect(mockFetchViaProxy).toHaveBeenCalledWith(expect.stringContaining('hl=zh-TW'));
        expect(mockFetchViaProxy).toHaveBeenCalledWith(expect.stringContaining('gl=TW'));
        expect(mockFetchViaProxy).toHaveBeenCalledWith(expect.stringContaining('ceid=TW%3Azh-Hant'));
    });

    it('.TWO suffix (上櫃) — routes to Google News', async () => {
        mockFetchViaProxy.mockResolvedValue(makeXMLResponse(EMPTY_RSS));
        await fetchNews('6488.TWO');
        expect(mockFetchViaProxy).toHaveBeenCalledWith(expect.stringContaining('news.google.com'));
        expect(mockFetchViaProxy).toHaveBeenCalledWith(expect.stringContaining('hl=zh-TW'));
        // query strips .TWO suffix: "6488 台股"
        const calledUrl = mockFetchViaProxy.mock.calls[0][0];
        expect(decodeURIComponent(calledUrl)).toContain('6488 台股');
    });

    it('Crypto BTC-USD — routes to Google News with stripped base + 加密貨幣', async () => {
        mockFetchViaProxy.mockResolvedValue(makeXMLResponse(EMPTY_RSS));
        await fetchNews('BTC-USD');
        expect(mockFetchViaProxy).toHaveBeenCalledWith(expect.stringContaining('news.google.com'));
        const calledUrl = mockFetchViaProxy.mock.calls[0][0];
        expect(decodeURIComponent(calledUrl)).toContain('BTC 加密貨幣');
        expect(calledUrl).not.toContain('BTC-USD');
    });
});

describe('fetchNews — Google News (ZH) path: RSS parsing', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        invalidateNewsCache();
    });

    it('happy path: parses title, link, pubDate, source', async () => {
        mockFetchViaProxy.mockResolvedValue(makeXMLResponse(SAMPLE_RSS));
        const items = await fetchNews('2330.TW');
        expect(items).toHaveLength(2);
        // sorted desc by providerPublishTime
        expect(items[0].title).toBe('台積電法說會重點摘要');
        expect(items[0].providerPublishTime).toBeGreaterThan(items[1].providerPublishTime);
    });

    it('valid <source> populates publisher field (工商時報)', async () => {
        mockFetchViaProxy.mockResolvedValue(makeXMLResponse(SAMPLE_RSS));
        const items = await fetchNews('2330.TW');
        const sources = items.map((i) => i.publisher);
        expect(sources).toContain('工商時報');
        expect(sources).toContain('鉅亨網');
    });

    it('missing <pubDate> — item filtered out', async () => {
        const xml = `<?xml version="1.0"?><rss><channel>
            <item>
                <title>No date item</title>
                <link>https://news.google.com/x</link>
                <source>X</source>
            </item>
        </channel></rss>`;
        mockFetchViaProxy.mockResolvedValue(makeXMLResponse(xml));
        const items = await fetchNews('2330.TW');
        expect(items).toEqual([]);
    });

    it('missing <source> — falls back to 財經新聞', async () => {
        const xml = `<?xml version="1.0"?><rss><channel>
            <item>
                <title>No source</title>
                <link>https://news.google.com/x</link>
                <pubDate>Mon, 15 May 2026 10:00:00 GMT</pubDate>
            </item>
        </channel></rss>`;
        mockFetchViaProxy.mockResolvedValue(makeXMLResponse(xml));
        const items = await fetchNews('2330.TW');
        expect(items).toHaveLength(1);
        expect(items[0].publisher).toBe('財經新聞');
    });

    it('missing <link> — item filtered out', async () => {
        const xml = `<?xml version="1.0"?><rss><channel>
            <item>
                <title>No link</title>
                <pubDate>Mon, 15 May 2026 10:00:00 GMT</pubDate>
                <source>X</source>
            </item>
        </channel></rss>`;
        mockFetchViaProxy.mockResolvedValue(makeXMLResponse(xml));
        const items = await fetchNews('2330.TW');
        expect(items).toEqual([]);
    });

    it('non-https <link> — item filtered out', async () => {
        const xml = `<?xml version="1.0"?><rss><channel>
            <item>
                <title>Unsafe</title>
                <link>http://news.example.com/x</link>
                <pubDate>Mon, 15 May 2026 10:00:00 GMT</pubDate>
            </item>
            <item>
                <title>Bad</title>
                <link>javascript:alert(1)</link>
                <pubDate>Mon, 15 May 2026 10:00:00 GMT</pubDate>
            </item>
            <item>
                <title>Safe</title>
                <link>https://news.google.com/safe</link>
                <pubDate>Mon, 15 May 2026 10:00:00 GMT</pubDate>
            </item>
        </channel></rss>`;
        mockFetchViaProxy.mockResolvedValue(makeXMLResponse(xml));
        const items = await fetchNews('2330.TW');
        expect(items).toHaveLength(1);
        expect(items[0].title).toBe('Safe');
    });

    it('malformed XML — returns []', async () => {
        mockFetchViaProxy.mockResolvedValue(makeXMLResponse('<not valid xml<<<'));
        const items = await fetchNews('2330.TW');
        expect(items).toEqual([]);
    });

    it('unparseable pubDate — item filtered out', async () => {
        const xml = `<?xml version="1.0"?><rss><channel>
            <item>
                <title>Bad date</title>
                <link>https://news.google.com/x</link>
                <pubDate>not a real date</pubDate>
            </item>
        </channel></rss>`;
        mockFetchViaProxy.mockResolvedValue(makeXMLResponse(xml));
        const items = await fetchNews('2330.TW');
        expect(items).toEqual([]);
    });

    it('CDATA in title — preserved by DOMParser', async () => {
        const xml = `<?xml version="1.0"?><rss><channel>
            <item>
                <title><![CDATA[台積電 & 鴻海 "雙雄"]]></title>
                <link>https://news.google.com/x</link>
                <pubDate>Mon, 15 May 2026 10:00:00 GMT</pubDate>
            </item>
        </channel></rss>`;
        mockFetchViaProxy.mockResolvedValue(makeXMLResponse(xml));
        const items = await fetchNews('2330.TW');
        expect(items).toHaveLength(1);
        expect(items[0].title).toBe('台積電 & 鴻海 "雙雄"');
    });

    it('more than 5 items — slices to top 5 by recency', async () => {
        const items = Array.from({ length: 8 }, (_, i) => `
            <item>
                <title>Item ${i}</title>
                <link>https://news.google.com/${i}</link>
                <pubDate>Mon, ${10 + i} May 2026 10:00:00 GMT</pubDate>
            </item>`).join('');
        const xml = `<?xml version="1.0"?><rss><channel>${items}</channel></rss>`;
        mockFetchViaProxy.mockResolvedValue(makeXMLResponse(xml));
        const result = await fetchNews('2330.TW');
        expect(result).toHaveLength(5);
        // most recent first (item 7, item 6, ...)
        expect(result[0].title).toBe('Item 7');
    });

    it('cache hit on ZH path — skips re-fetch', async () => {
        mockFetchViaProxy.mockResolvedValue(makeXMLResponse(SAMPLE_RSS));
        await fetchNews('2330.TW');
        mockFetchViaProxy.mockClear();
        const items = await fetchNews('2330.TW');
        expect(items).toHaveLength(2);
        expect(mockFetchViaProxy).not.toHaveBeenCalled();
    });
});

describe('fetchNewsBatch', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        invalidateNewsCache();
    });

    it('4 symbols — fires in 2 batches of 3+1', async () => {
        mockFetchViaProxy.mockResolvedValue(makeResponse({ news: sampleNews }));
        const results = await fetchNewsBatch(['AAPL', 'MSFT', 'NVDA', 'GOOG']);
        expect(results.size).toBe(4);
        expect(mockFetchViaProxy).toHaveBeenCalledTimes(4);
    });

    it('failed symbol — other symbols still return results', async () => {
        mockFetchViaProxy
            .mockResolvedValueOnce(makeResponse({ news: sampleNews }))
            .mockRejectedValueOnce(new Error('timeout'))
            .mockResolvedValueOnce(makeResponse({ news: sampleNews }));
        const results = await fetchNewsBatch(['AAPL', 'MSFT', 'NVDA']);
        expect(results.get('AAPL')).toHaveLength(2);
        expect(results.get('MSFT')).toEqual([]);
        expect(results.get('NVDA')).toHaveLength(2);
    });
});

describe('timeAgo', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('seconds', () => {
        const now = 1_700_000_000;
        vi.setSystemTime(now * 1000);
        expect(timeAgo(now - 30)).toBe('30s ago');
    });

    it('minutes', () => {
        const now = 1_700_000_000;
        vi.setSystemTime(now * 1000);
        expect(timeAgo(now - 90)).toBe('1m ago');
    });

    it('hours', () => {
        const now = 1_700_000_000;
        vi.setSystemTime(now * 1000);
        expect(timeAgo(now - 7200)).toBe('2h ago');
    });

    it('days', () => {
        const now = 1_700_000_000;
        vi.setSystemTime(now * 1000);
        expect(timeAgo(now - 86400 * 3)).toBe('3d ago');
    });
});
