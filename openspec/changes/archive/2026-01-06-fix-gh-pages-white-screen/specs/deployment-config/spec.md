# Spec: Deployment Configuration

## ADDED Requirements

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
