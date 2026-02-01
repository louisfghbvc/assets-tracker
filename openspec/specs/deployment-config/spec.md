# deployment-config Specification

## Purpose
TBD - created by archiving change fix-gh-pages-white-screen. Update Purpose after archive.
## Requirements
### Requirement: Asset Resolution
The application SHALL correctly load all static assets when deployed to any subdirectory.

#### Scenario: Subdirectory Deployment
- **Given** the application is hosted at `https://example.com/sub/`
- **When** the page is loaded
- **Then** the browser should fetch `main.js` from `https://example.com/sub/assets/main.js` (or relative equivalent) instead of `https://example.com/assets/main.js`.

### Requirement: Build Base Path
The Vite build process MUST generate relative URLs for all injected assets.

#### Scenario: Vite Build Output
- **Given** a standard build command `npm run build`
- **When** the build completes
- **Then** `dist/index.html` should contain relative paths for `<script>` and `<link>` tags.

### Requirement: Worker Deployment Configuration
The deployment process SHALL include steps for deploying and configuring the Cloudflare Worker proxy.

#### Scenario: Initial Worker Setup
- **Given** a new deployment of AssetTracker
- **When** following deployment documentation
- **Then** user should be guided through:
  - Creating Cloudflare account
  - Deploying worker via `wrangler publish`
  - Obtaining worker URL
  - Configuring `VITE_CORS_PROXY_URL` environment variable

#### Scenario: GitHub Pages Build
- **Given** `VITE_CORS_PROXY_URL` is set in repository secrets
- **When** GitHub Actions builds the project
- **Then** the worker URL should be injected into the built application
- **And** application should use worker for all proxy requests

---

### Requirement: Environment Variable Documentation
The project documentation MUST clearly specify all required environment variables including the worker proxy URL.

#### Scenario: Environment Setup
- **Given** `.env.example` file
- **When** developer reviews it
- **Then** it should include:
  ```
  # Cloudflare Worker Proxy (optional, falls back to free proxies)
  VITE_CORS_PROXY_URL=https://your-worker.workers.dev/proxy
  ```
- **And** comments should explain the purpose and impact

