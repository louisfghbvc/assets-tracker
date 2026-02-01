# Tasks: Add Cloudflare Workers Proxy

## Overview
Implement a reliable CORS proxy using Cloudflare Workers to achieve 100% success rate for price fetching and exchange API integration on GitHub Pages deployment.

---

## Phase 1: Worker Setup & Implementation

### Task 1.1: Create Cloudflare Worker Project
**Dependencies**: None  
**Estimated Time**: 15 minutes

- [x] Create `workers/` directory in project root
- [x] Initialize Cloudflare Worker with `wrangler init cors-proxy`
- [x] Configure `wrangler.toml` with worker name and routing
- [x] Add `.gitignore` entries for worker build artifacts

**Validation**: Worker project structure exists and wrangler configuration is valid

---

### Task 1.2: Implement Proxy Endpoint
**Dependencies**: 1.1  
**Estimated Time**: 30 minutes

- [x] Create worker script with POST endpoint `/proxy`
- [x] Extract target URL from request body
- [x] Forward request to target URL with all headers
- [x] Add CORS headers to response (`Access-Control-Allow-Origin: *`)
- [x] Handle preflight OPTIONS requests
- [x] Add error handling and logging

**Validation**: Worker responds correctly to test requests locally (`wrangler dev`)

**Acceptance Criteria**:
```bash
# Test request should succeed
curl -X POST https://localhost:8787/proxy \
  -H "Content-Type: application/json" \
  -d '{"url":"https://query1.finance.yahoo.com/v8/finance/chart/AAPL"}'
```

---

### Task 1.3: Deploy Worker to Cloudflare
**Dependencies**: 1.2  
**Estimated Time**: 15 minutes

- [ ] Deploy worker using `wrangler publish`
- [ ] Verify worker is accessible at `https://YOUR_NAME.workers.dev/proxy`
- [ ] Test with production Yahoo Finance and TWSE endpoints
- [ ] Record worker URL for environment configuration

**Validation**: Worker publicly accessible and returns correct CORS headers

---

## Phase 2: Frontend Integration

### Task 2.1: Add Worker Environment Variable
**Dependencies**: 1.3 (parallel with 2.2)  
**Estimated Time**: 10 minutes

- [x] Add `VITE_CORS_PROXY_URL` to `.env.example`
- [x] Update build documentation with required env var
- [x] Configure GitHub Pages deployment secrets/vars
- [x] Add fallback handling if env var missing

**Validation**: Build succeeds with and without env var set

---

### Task 2.2: Update Price Service
**Dependencies**: 1.3 (can start in parallel with 2.1)  
**Estimated Time**: 30 minutes

- [x] Modify `src/services/price.ts` to check for `VITE_CORS_PROXY_URL`
- [x] If worker URL available, use it as primary proxy
- [x] Keep existing free proxies as fallback
- [x] Update `fetchWithTimeout` to use worker endpoint format
- [x] Add logging to distinguish worker vs fallback requests

**Validation**: 
- Local dev with worker env var: uses worker
- Local dev without env var: uses free proxies  
- Success rate improves to near 100%

**Test Scenarios**:
```typescript
// With VITE_CORS_PROXY_URL set
const prices = await priceService.fetchPrices(['AAPL', 'TSLA', '2330.TW']);
// Should use worker for all requests

// Without VITE_CORS_PROXY_URL  
const prices = await priceService.fetchPrices(['AAPL']);
// Should fallback to api.codetabs.com
```

---

### Task 2.3: Update Exchange Service
**Dependencies**: 2.2  
**Estimated Time**: 20 minutes

- [x] Modify `src/services/exchange.ts` to use worker proxy
- [x] Ensure custom headers (API keys, signatures) are forwarded
- [ ] Test Pionex and BitoPro sync on web platform
- [x] Add error handling for worker failures

**Validation**: 
- Pionex sync works on localhost with worker
- BitoPro sync works on localhost with worker
- Proper error messages if worker unavailable

---

## Phase 3: Testing & Validation

### Task 3.1: Integration Testing
**Dependencies**: 2.3  
**Estimated Time**: 30 minutes

- [ ] Test complete price refresh flow with all asset types (TW, US, Crypto)
- [ ] Test exchange sync for Pionex and BitoPro
- [ ] Verify no "Too many requests" errors with realistic data set
- [ ] Test fallback behavior when worker returns errors
- [ ] Load test: fetch 20+ assets simultaneously

**Validation**: All tests pass with 100% success rate

---

### Task 3.2: Production Deployment
**Dependencies**: 3.1  
**Estimated Time**: 20 minutes

- [ ] Set `VITE_CORS_PROXY_URL` in GitHub repository secrets
- [ ] Trigger new GitHub Pages deployment
- [ ] Verify worker URL is correctly injected into build
- [ ] Test production deployment with real user flow
- [ ] Monitor for any errors in browser console

**Validation**: 
- GitHub Pages shows 100% price fetch success
- Exchange sync functional on production
- No CORS errors in console

---

## Phase 4: Documentation

### Task 4.1: Add Deployment Documentation
**Dependencies**: 3.2  
**Estimated Time**: 30 minutes

- [x] Create `docs/cloudflare-worker-setup.md`
- [x] Document Cloudflare account setup steps
- [x] Document worker deployment command
- [x] Document environment variable configuration
- [x] Add troubleshooting section for common issues

**Deliverable**: Complete standalone guide for deploying worker

---

### Task 4.2: Update README
**Dependencies**: 4.1  
**Estimated Time**: 10 minutes

- [x] Add "Deployment" section mentioning worker requirement
- [x] Link to detailed worker setup guide
- [x] Document fallback proxy behavior
- [ ] Update architecture diagram if exists

**Validation**: README clearly explains deployment options

---

## Optional Enhancements (Future)

### Task 5.1: Add Request Caching (Optional)
**Dependencies**: 3.2  
**Estimated Time**: 45 minutes

- [ ] Implement Cloudflare KV caching in worker
- [ ] Cache price data for 1 minute
- [ ] Add cache headers to responses
- [ ] Reduce redundant API calls

**Benefit**: Further improves reliability and reduces API usage

---

### Task 5.2: Add Rate Limiting (Optional)
**Dependencies**: 3.2  
**Estimated Time**: 30 minutes

- [ ] Add rate limiting per IP address
- [ ] Prevent abuse of worker endpoint
- [ ] Return 429 with Retry-After header

**Benefit**: Protects against potential abuse

---

## Summary

**Total Estimated Time**: ~4 hours (required tasks only)  
**Optional Enhancements**: +1.25 hours

**Priorities**:
1. **Critical**: Tasks 1.1 - 2.3 (Core functionality)
2. **High**: Tasks 3.1 - 3.2 (Testing & deployment)
3. **Medium**: Tasks 4.1 - 4.2 (Documentation)
4. **Low**: Tasks 5.x (Optional enhancements)

**Parallelizable Work**:
- Tasks 2.1 and 2.2 can be done simultaneously
- Documentation (Phase 4) can start after Phase 2 completes

**Rollback Plan**: If worker fails in production, app automatically falls back to existing free proxies
