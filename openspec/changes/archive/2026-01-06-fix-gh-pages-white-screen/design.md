# Design: Deployment Configuration Fix

## Architectural Reasoning
To ensure the application is portable across different hosting environments (Tauri, local dev, GitHub Pages, PWA), we must move away from absolute root-relative paths.

### Change Summary
- **Vite Configuration**: Setting `base: './'` allows the build output to work regardless of the subdirectory depth. This is particularly useful for GitHub Pages where the project name acts as a base path.
- **HTML Assets**: Switching from `/` to `./` in `index.html` ensures that the browser looks for icons and scripts relative to the current directory.

### Trade-offs
- Setting `base: './'` is generally safer for static sites but can sometimes cause issues with deep routing if not using a hash router. Since this app uses state-based navigation (no router), it is the ideal choice.
