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

const sampleNews = [
    { title: 'Article A', publisher: 'Reuters', link: 'https://a.com/1', providerPublishTime: 1000 },
    { title: 'Article B', publisher: 'Bloomberg', link: 'https://b.com/2', providerPublishTime: 2000 },
];

describe('fetchNews', () => {
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

            // Advance past 15min TTL
            vi.advanceTimersByTime(16 * 60 * 1000);
            mockFetchViaProxy.mockClear();

            await fetchNews('NVDA');
            expect(mockFetchViaProxy).toHaveBeenCalledTimes(1);
        } finally {
            vi.useRealTimers();
        }
    });

    it('TW symbol 2330.TW — queries as-is', async () => {
        mockFetchViaProxy.mockResolvedValue(makeResponse({ news: [] }));
        await fetchNews('2330.TW');
        expect(mockFetchViaProxy).toHaveBeenCalledWith(expect.stringContaining('q=2330.TW'));
    });

    it('US symbol NVDA — queries as-is', async () => {
        mockFetchViaProxy.mockResolvedValue(makeResponse({ news: [] }));
        await fetchNews('NVDA');
        expect(mockFetchViaProxy).toHaveBeenCalledWith(expect.stringContaining('q=NVDA'));
    });

    it('Crypto BTC-USD — queries BTC (strips fiat suffix)', async () => {
        mockFetchViaProxy.mockResolvedValue(makeResponse({ news: [] }));
        await fetchNews('BTC-USD');
        expect(mockFetchViaProxy).toHaveBeenCalledWith(expect.stringContaining('q=BTC'));
        expect(mockFetchViaProxy).toHaveBeenCalledWith(expect.not.stringContaining('BTC-USD'));
    });

    it('BRK-A — queries BRK-A as-is (non-fiat suffix)', async () => {
        mockFetchViaProxy.mockResolvedValue(makeResponse({ news: [] }));
        await fetchNews('BRK-A');
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
    // Use fake timers so tests don't flicker at second boundaries
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
