# Project Context

## Purpose
AssetTracker is a personalized cross-platform asset tracking system designed to manage holdings across different brokers and wallets. It aims to provide a unified view of Taiwan stocks, US stocks, and cryptocurrencies with high performance and a premium user experience.

## Tech Stack
- **Framework**: Tauri v2 (for Desktop/Mobile)
- **Frontend**: React 19, TypeScript, Vite
- **Styling**: Vanilla CSS (Modern aesthetics, glassmorphism)
- **Database**: Dexie.js (local IndexedDB storage)
- **Cloud Sync**: Google Sheets API v4 & Google Drive API v3
- **Mobile/Web**: PWA support via `vite-plugin-pwa`
- **UI Components**: Lucide React (icons), Recharts (data visualization)

## Project Conventions

### Code Style
- **TypeScript**: Use strict typing and interfaces for data models.
- **Components**: Functional components with hooks.
- **Styling**: Prefer scoped CSS or global theme tokens in `index.css`. Use glassmorphism and modern UI patterns.
- **Naming**: camelCase for variables/functions, PascalCase for components/files.

### Architecture Patterns
- **Manual Cloud Sync**: "App-as-Source-of-Truth" strategy where users manually upload/download data to/from Google Sheets to avoid conflicts.
- **Local-First**: Primary data storage is in Dexie.js (IndexedDB), ensuring offline functionality.
- **Service Layer**: Business logic (e.g., search, price fetching, sync) is encapsulated in the `src/services/` directory.

### Testing Strategy
- Currently focusing on manual verification and build checks. Automated tests to be implemented.

### Git Workflow
- Feature-based development.
- Main branch reflects the latest stable version for deployment (Web/PWA).

## Domain Context
- **Asset Management**: Tracking diverse financial assets with real-time or historical price updates.
- **Google Integration**: Leveraging Google's ecosystem for free, user-controlled cloud storage.
- **Cross-Platform Delivery**: Supporting Windows, macOS, Linux, Android, iOS, and Web from a single codebase.

## Important Constraints
- **OAuth Setup**: Requires valid Google Client ID in `.env`.
- **API Limits**: Adhere to Google API usage quotas.
- **Privacy**: Implement "Privacy Mode" to hide sensitive financial values quickly.

## External Dependencies
- Google Cloud Console (APIs & Services)
- Google Drive & Sheets
- Financial data APIs (for price fetching)
