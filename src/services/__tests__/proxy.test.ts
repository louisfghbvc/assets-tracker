import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('fetchViaProxy', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.unstubAllEnvs();
        vi.resetModules();
        globalThis.fetch = vi.fn();
    });

    it('returns null when VITE_CORS_PROXY_URL is unset', async () => {
        vi.stubEnv('VITE_CORS_PROXY_URL', '');
        const { fetchViaProxy } = await import('../proxy');
        const result = await fetchViaProxy('https://example.com');
        expect(result).toBeNull();
        expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('returns null when AbortController times out', async () => {
        vi.stubEnv('VITE_CORS_PROXY_URL', 'https://proxy.example.com');
        (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation(
            () => new Promise((_, reject) => setTimeout(() => reject(new DOMException('Aborted', 'AbortError')), 50))
        );
        const { fetchViaProxy } = await import('../proxy');
        const result = await fetchViaProxy('https://example.com', 1);
        expect(result).toBeNull();
    });

    it('returns null when fetch throws', async () => {
        vi.stubEnv('VITE_CORS_PROXY_URL', 'https://proxy.example.com');
        (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network error'));
        const { fetchViaProxy } = await import('../proxy');
        const result = await fetchViaProxy('https://example.com');
        expect(result).toBeNull();
    });

    it('returns null when response.ok is false', async () => {
        vi.stubEnv('VITE_CORS_PROXY_URL', 'https://proxy.example.com');
        (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false });
        const { fetchViaProxy } = await import('../proxy');
        const result = await fetchViaProxy('https://example.com');
        expect(result).toBeNull();
    });

    it('returns Response on happy path', async () => {
        vi.stubEnv('VITE_CORS_PROXY_URL', 'https://proxy.example.com');
        const mockResponse = { ok: true, json: async () => ({}) };
        (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);
        const { fetchViaProxy } = await import('../proxy');
        const result = await fetchViaProxy('https://example.com');
        expect(result).toBe(mockResponse);
        expect(globalThis.fetch).toHaveBeenCalledWith(
            'https://proxy.example.com',
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ url: 'https://example.com' }),
            })
        );
    });
});
