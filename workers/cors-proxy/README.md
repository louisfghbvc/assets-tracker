# AssetTracker CORS Proxy Worker

Cloudflare Worker that provides CORS proxy functionality for AssetTracker GitHub Pages deployment.

## Purpose

Enables the web version of AssetTracker to fetch financial data from APIs like Yahoo Finance, TWSE, Pionex, and BitoPro without being blocked by browser CORS policies.

## Deployment

### Prerequisites

- [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier is sufficient)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) installed

```bash
npm install -g wrangler
```

### Deploy

1. Login to Cloudflare:
```bash
wrangler login
```

2. Deploy the worker from the `workers/cors-proxy` directory:
```bash
cd workers/cors-proxy
wrangler deploy
```

3. Note the worker URL (e.g., `https://assettracker-cors-proxy.YOUR_SUBDOMAIN.workers.dev`)

4. Set the worker URL in your environment:
```bash
# For local development
echo "VITE_CORS_PROXY_URL=https://assettracker-cors-proxy.YOUR_SUBDOMAIN.workers.dev/proxy" >> .env

# For GitHub Pages (add to repository secrets)
# Settings > Secrets and variables > Actions > New repository secret
# Name: VITE_CORS_PROXY_URL
# Value: https://assettracker-cors-proxy.YOUR_SUBDOMAIN.workers.dev/proxy
```

## API Usage

### Request Format

```bash
POST /proxy
Content-Type: application/json

{
  "url": "https://api.example.com/data",
  "method": "GET",  # optional, defaults to GET
  "body": {}        # optional, for POST requests
}
```

### Example

```bash
curl -X POST https://your-worker.workers.dev/proxy \
  -H "Content-Type: application/json" \
  -d '{"url":"https://query1.finance.yahoo.com/v8/finance/chart/AAPL"}'
```

## Free Tier Limits

Cloudflare Workers free tier includes:
- 100,000 requests per day
- 10ms CPU time per request
- More than sufficient for personal AssetTracker usage

## Monitoring

View worker analytics and logs:
```bash
wrangler tail
```

Or visit: https://dash.cloudflare.com/workers
