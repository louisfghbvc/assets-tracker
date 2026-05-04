const workerProxyUrl = import.meta.env.VITE_CORS_PROXY_URL;

export async function fetchViaProxy(url: string, timeoutMs = 5000): Promise<Response | null> {
    if (!workerProxyUrl) return null;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(workerProxyUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url }),
            signal: controller.signal,
        });
        clearTimeout(timeout);
        return response.ok ? response : null;
    } catch {
        clearTimeout(timeout);
        return null;
    }
}
