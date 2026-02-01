# price-service Specification

## Purpose
TBD - created by archiving change add-cloudflare-workers-proxy. Update Purpose after archive.
## Requirements
### Requirement: Proxy Selection Strategy
The price service SHALL prioritize the Cloudflare Worker proxy when available, falling back to free third-party proxies only when the worker is unavailable.

#### Scenario: Worker Available
- **Given** `VITE_CORS_PROXY_URL` environment variable is set
- **When** fetching prices for any symbol
- **Then** the service should use the worker endpoint as the primary proxy
- **And** log should indicate "Using worker proxy"

#### Scenario: Worker Unavailable
- **Given** `VITE_CORS_PROXY_URL` is not set OR worker returns error
- **When** fetching prices
- **Then** the service should fall back to free proxies (api.codetabs.com, etc.)
- **And** log should indicate fallback proxy used

---

### Requirement: 100% Success Rate
The price service SHALL achieve 100% success rate when using the Cloudflare Worker proxy under normal conditions.

#### Scenario: Batch Price Fetch
- **Given** worker proxy is configured and healthy
- **When** fetching prices for 20 different symbols (TW stocks, US stocks, crypto)
- **Then** all 20 symbols should successfully return a price
- **And** no "Failed to fetch" errors should appear in logs

#### Scenario: Exchange API Reliability
- **Given** worker proxy with custom header support
- **When** syncing Pionex or BitoPro accounts
- **Then** API requests should succeed 100% of the time
- **And** balances should be correctly updated

