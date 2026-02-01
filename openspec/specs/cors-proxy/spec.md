# cors-proxy Specification

## Purpose
TBD - created by archiving change add-cloudflare-workers-proxy. Update Purpose after archive.
## Requirements
### Requirement: Request Forwarding
The worker SHALL accept POST requests containing a target URL and forward them to the destination with all necessary headers preserved.

#### Scenario: Basic Proxy Request
- **Given** a client sends POST to `/proxy` with `{"url": "https://api.example.com/data"}`
- **When** the worker processes the request
- **Then** it should fetch `https://api.example.com/data` and return the response with CORS headers

#### Scenario: Header Preservation
- **Given** a client sends custom headers (e.g., `X-API-KEY: abc123`)
- **When** the worker forwards the request
- **Then** all client headers should be included in the proxied request

---

### Requirement: CORS Headers
The worker MUST respond with appropriate CORS headers to allow browser-based requests from any origin.

#### Scenario: Preflight Request
- **Given** browser sends OPTIONS request to `/proxy`
- **When** worker handles the preflight
- **Then** it should respond with:
  - `Access-Control-Allow-Origin: *`
  - `Access-Control-Allow-Methods: GET, POST, OPTIONS`
  - `Access-Control-Allow-Headers: *`
  - HTTP 204 status

#### Scenario: Actual Request
- **Given** any POST/GET request to `/proxy`
- **When** worker responds
- **Then** response must include `Access-Control-Allow-Origin: *` header

---

### Requirement: Error Handling
The worker SHALL gracefully handle errors and return informative responses.

#### Scenario: Invalid Target URL
- **Given** request body contains invalid URL (e.g., `{"url": "not-a-url"}`)
- **When** worker validates the request
- **Then** it should return 400 Bad Request with error message

#### Scenario: Target API Failure
- **Given** target API returns 500 error or times out
- **When** worker attempts to fetch
- **Then** it should forward the error status and response body to client

---

### Requirement: Performance
The worker SHALL respond within 2 seconds for 95% of requests under normal load.

#### Scenario: Global Latency
- **Given** requests from different global regions
- **When** measured over 100 requests
- **Then** P95 latency should be < 2000ms
- **And** P50 latency should be < 500ms

