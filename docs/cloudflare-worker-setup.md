# Cloudflare Worker Setup Guide

This guide explains how to deploy your own Cloudflare Worker proxy for AssetTracker to achieve 100% reliable price fetching.

## Why Do I Need This?

Without your own worker proxy:
- ❌ Price fetching success rate: ~85-95%
- ❌ Exchange APIs (Pionex/BitoPro) don't work on web
- ❌ Dependent on unreliable free proxies

With your own worker proxy:
- ✅ Price fetching success rate: 100%
- ✅ Exchange APIs work perfectly on web
- ✅ Free (Cloudflare's generous free tier)
- ✅ Fast (global CDN)

## Prerequisites

1. **Cloudflare Account** (free): [Sign up here](https://dash.cloudflare.com/sign-up)
2. **Wrangler CLI**: Cloudflare's command-line tool

Install Wrangler globally:
```bash
npm install -g wrangler
```

## Deployment Steps

### Step 1: Login to Cloudflare

```bash
wrangler login
```

This will open your browser to authenticate.

### Step 2: Deploy the Worker

From the project root directory:

```bash
cd workers/cors-proxy
wrangler deploy
```

You should see output like:
```
✨ Success! Published assettracker-cors-proxy (0.34 sec)
  https://assettracker-cors-proxy.YOUR_SUBDOMAIN.workers.dev
```

**💡 Important**: Copy the URL from the output! You'll need it in the next step.

### Step 3: Configure Your Application

#### For Local Development

Create a `.env` file in the project root (copy from `.env.example`):

```bash
cp .env.example .env
```

Edit `.env` and set your worker URL:

```env
VITE_GOOGLE_CLIENT_ID=your_google_client_id_here
VITE_CORS_PROXY_URL=https://assettracker-cors-proxy.YOUR_SUBDOMAIN.workers.dev/proxy
```

⚠️ **Don't forget the `/proxy` at the end!**

#### For GitHub Pages Deployment

1. Go to your GitHub repository
2. Navigate to: **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add the following secret:
   - **Name**: `VITE_CORS_PROXY_URL`
   - **Value**: `https://assettracker-cors-proxy.YOUR_SUBDOMAIN.workers.dev/proxy`

5. Update your GitHub Actions workflow (`.github/workflows/deploy.yml`):

```yaml
env:
  VITE_GOOGLE_CLIENT_ID: ${{ secrets.VITE_GOOGLE_CLIENT_ID }}
  VITE_CORS_PROXY_URL: ${{ secrets.VITE_CORS_PROXY_URL }}
```

### Step 4: Test It

#### Test the worker directly:

```bash
curl -X POST https://assettracker-cors-proxy.YOUR_SUBDOMAIN.workers.dev/proxy \
  -H "Content-Type: application/json" \
  -d '{"url":"https://query1.finance.yahoo.com/v8/finance/chart/AAPL"}'
```

You should get Apple stock data back.

#### Test in your app:

1. Start the dev server: `npm run dev`
2. Open the browser console
3. Refresh prices
4. Look for logs like: `✓ AAPL: $XXX (via worker)`

If you see `(via worker)`, it's working! 🎉

## Monitoring & Management

### View Worker Logs

```bash
cd workers/cors-proxy
wrangler tail
```

This shows real-time logs of requests hitting your worker.

### View Analytics Dashboard

Visit: https://dash.cloudflare.com/workers

You can see:
- Number of requests
- Success rate
- Response time
- Errors

### Update the Worker

If you make changes to `workers/cors-proxy/src/index.js`:

```bash
cd workers/cors-proxy
wrangler deploy
```

No need to reconfigure anything - the URL stays the same.

## Free Tier Limits

Cloudflare Workers free tier includes:

| Resource | Free Tier | Typical Usage |
|----------|-----------|---------------|
| Requests/day | 100,000 | ~5,000 for personal use |
| CPU time/request | 10ms | ~2-5ms for proxy |
| Worker count | Unlimited | You only need 1 |

**You'll likely use less than 1% of the free tier quota.**

## Troubleshooting

### "Worker not found" error

- Check that you deployed with `wrangler deploy`
- Verify the URL matches what `wrangler deploy` outputted
- Make sure `/proxy` is at the end of the URL

### "Still using fallback proxies"

- Check browser console for worker errors
- Verify `VITE_CORS_PROXY_URL` is set correctly
- Try `echo $VITE_CORS_PROXY_URL` (or check `.env` file)
- Rebuild the app: `npm run build`

### Exchange APIs still failing

- Worker should allow custom headers
- Check browser console for specific error messages
- Try testing worker directly with curl (see Step 4)

### \"Rate limit exceeded\" from worker

This shouldn't happen on your personal worker. If it does:
- Check Cloudflare dashboard for unusual activity
- Verify you're the only one using your worker URL
- Consider adding rate limiting (see optional task 5.2)

## Security Notes

⚠️ **Important**: Your worker URL should be kept relatively private. While it's not a secret key, you don't want to share it publicly as it could lead to:

1. **Abuse**: Others using your quota
2. **Rate limiting**: If traffic exceeds free tier

**Best practices**:
- Don't commit the URL to public Git repos
- Use environment variables (`.env` is in `.gitignore`)
- Use GitHub secrets for deployment

## Optional: Add Custom Domain

If you have a domain on Cloudflare:

1. Go to Cloudflare Dashboard → Workers & Pages
2. Select your worker
3. Click **Triggers** → **Custom Domains**
4. Add your custom domain (e.g., `proxy.yourdomain.com`)

Then update `VITE_CORS_PROXY_URL` to use your custom domain.

## Cost Estimate

**Estimated monthly cost: $0**

- Free tier: 100,000 requests/day = ~3,000,000/month
- Typical usage: ~5,000/month (0.17% of quota)
- You'd need to refresh prices 3,000+ times/day to exceed free tier

**Only consider paid tier ($5/month) if**:
- You're sharing the app with many users
- You have 100+ assets and refresh every minute

## Need Help?

1. **Worker not deploying**: Check [Wrangler docs](https://developers.cloudflare.com/workers/wrangler)
2. **CORS errors**: Verify worker code matches `workers/cors-proxy/src/index.js`
3. **Still having issues**: Open a GitHub issue with:
   - Error messages from browser console
   - Output from `wrangler tail`
   - Your `wrangler.toml` file (without sensitive data)
