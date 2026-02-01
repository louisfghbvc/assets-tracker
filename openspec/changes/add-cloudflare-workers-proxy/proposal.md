# Proposal: Add Cloudflare Workers Proxy

## Change ID
`add-cloudflare-workers-proxy`

## Status
🟡 Proposed

## Summary
Implement a Cloudflare Workers-based CORS proxy to achieve 100% reliable price fetching and exchange API integration for the GitHub Pages deployment, eliminating dependency on unreliable third-party CORS proxies.

## Background

### Current Problem
The GitHub Pages deployment currently relies on free third-party CORS proxies (`api.codetabs.com`, `api.allorigins.win`, `corsproxy.io`) to fetch financial data from Yahoo Finance, TWSE, and exchange APIs. This approach has several critical issues:

1. **Rate Limiting**: `api.codetabs.com` returns "Too many requests" errors when fetching multiple assets
2. **Unreliability**: Proxies frequently return 403/500 errors or go offline
3. **Exchange API Failures**: Custom HTTP headers trigger CORS preflight requests that proxies cannot handle properly
4. **Success Rate**: Currently achieving only 85-95% success rate for price updates

### Why This Matters
- **User Experience**: Failed price updates lead to stale or missing data
- **Exchange Integration**: Pionex and BitoPro sync completely broken on web deployment
- **Production Readiness**: Cannot rely on app for real financial tracking with current failure rate

### Alternative Considered
**Tauri Desktop App**: Already implemented and works 100% reliably, but requires users to download/install native application instead of using web version.

## Proposed Solution

Deploy a custom Cloudflare Workers function that acts as a dedicated CORS proxy for AssetTracker:

```
GitHub Pages (Frontend)
       ↓
Cloudflare Worker (Our Proxy)
       ↓
Financial APIs (Yahoo, TWSE, Pionex, BitoPro)
```

### Key Features
1. **Dedicated Endpoint**: `https://YOUR_WORKER.workers.dev/proxy`
2. **No Rate Limits**: Under our control, can handle all app requests
3. **Custom Headers Support**: Properly forwards authentication headers for exchange APIs
4. **Free Tier**: 100,000 requests/day on Cloudflare's free plan
5. **Global CDN**: Low latency from anywhere in the world

### Technical Approach
1. Create Cloudflare Worker with proxy endpoint
2. Implement request forwarding with CORS headers
3. Add environment variable for worker URL
4. Update `price.ts` and `exchange.ts` to use worker
5. Add deployment instructions to docs

## Impact Assessment

### Benefits
- ✅ **100% Success Rate**: Complete control over proxy reliability
- ✅ **Exchange Sync Works**: Proper header forwarding enables Pionex/BitoPro
- ✅ **Free**: Within Cloudflare's generous free tier
- ✅ **Fast**: Global CDN distribution
- ✅ **Maintainable**: Simple worker code, easy to debug

### Risks & Mitigation
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Cloudflare free tier exceeded | Low | Medium | Monitor usage, add alerts |
| Worker downtime | Very Low | High | Cloudflare has >99.9% uptime SLA |
| API rate limits from sources | Low | Medium | Implement caching in worker |

### Trade-offs
- **Deployment Complexity**: Adds one more deployment step (worker)
- **Account Dependency**: Requires Cloudflare account
- **Mitigation**: Comprehensive documentation + optional fallback to free proxies

## Success Criteria
1. Price fetching achieves 100% success rate in production
2. Pionex and BitoPro exchange sync functions correctly on web
3. Average request latency < 500ms globally
4. Zero "Too many requests" errors in production
5. Documentation enables anyone to deploy their own worker

## Open Questions
1. Should we implement request caching in the worker to reduce API calls?
2. Should we add rate limiting per user to prevent abuse?
3. Do we want to support both worker proxy AND legacy free proxies as fallback?

## Related Specs
- `price-service`: Will modify to use worker endpoint
- `exchange-integration`: Will enable web platform support  
- `deployment-config`: Will add worker deployment steps

## Dependencies
- Cloudflare account (free tier sufficient)
- Environment variable configuration in GitHub Pages build
- Updated build/deploy workflow

## Timeline Estimate
- Design & Planning: 30 minutes
- Worker Implementation: 1 hour
- Frontend Integration: 1 hour
- Testing & Documentation: 1 hour
- **Total**: ~3.5 hours
