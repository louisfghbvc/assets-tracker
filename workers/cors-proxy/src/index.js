/**
 * AssetTracker CORS Proxy Worker
 * 
 * This Cloudflare Worker acts as a CORS proxy to enable the AssetTracker
 * GitHub Pages deployment to fetch financial data from various APIs without
 * being blocked by browser CORS policies.
 */

export default {
    async fetch(request, env, ctx) {
        // Handle CORS preflight requests
        if (request.method === 'OPTIONS') {
            return handlePreflight();
        }

        // Handle proxy requests
        if (request.method === 'POST' && new URL(request.url).pathname === '/proxy') {
            return handleProxyRequest(request);
        }

        // Default response for unsupported routes
        return new Response('AssetTracker CORS Proxy - Use POST /proxy', {
            status: 200,
            headers: corsHeaders(),
        });
    },
};

/**
 * Handle CORS preflight OPTIONS requests
 */
function handlePreflight() {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': '*',
            'Access-Control-Max-Age': '86400', // 24 hours
        },
    });
}

/**
 * Handle proxy POST requests
 */
async function handleProxyRequest(request) {
    try {
        // Parse request body
        const body = await request.json();
        const targetUrl = body.url;

        // Validate target URL
        if (!targetUrl || typeof targetUrl !== 'string') {
            return jsonError('Missing or invalid "url" field in request body', 400);
        }

        // Validate URL format
        let url;
        try {
            url = new URL(targetUrl);
        } catch (e) {
            return jsonError(`Invalid URL: ${targetUrl}`, 400);
        }

        // Forward the request to the target URL
        // Copy headers from original request (excluding Host and other hop-by-hop headers)
        const forwardHeaders = new Headers();
        for (const [key, value] of request.headers.entries()) {
            // Skip headers that shouldn't be forwarded
            if (!['host', 'connection', 'keep-alive', 'transfer-encoding', 'upgrade'].includes(key.toLowerCase())) {
                forwardHeaders.set(key, value);
            }
        }

        // Make the proxied request
        const response = await fetch(targetUrl, {
            method: body.method || 'GET',
            headers: forwardHeaders,
            body: body.body ? JSON.stringify(body.body) : undefined,
        });

        // Get response body
        const responseBody = await response.text();

        // Return response with CORS headers
        return new Response(responseBody, {
            status: response.status,
            statusText: response.statusText,
            headers: {
                ...corsHeaders(),
                'Content-Type': response.headers.get('Content-Type') || 'application/json',
            },
        });

    } catch (error) {
        console.error('Proxy error:', error);
        return jsonError(`Proxy request failed: ${error.message}`, 500);
    }
}

/**
 * Standard CORS headers
 */
function corsHeaders() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': '*',
    };
}

/**
 * Return JSON error response
 */
function jsonError(message, status = 400) {
    return new Response(JSON.stringify({ error: message }), {
        status,
        headers: {
            ...corsHeaders(),
            'Content-Type': 'application/json',
        },
    });
}
