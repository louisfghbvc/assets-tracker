# Tasks: Fix GitHub Pages White Screen

- [x] Configure Vite Base Path <!-- id: 0 -->
    - [x] Add `base: './'` to `vite.config.ts` <!-- id: 1 -->
- [x] Update HTML Entry Point <!-- id: 2 -->
    - [x] Change `/icon.png` to `./icon.png` in `index.html` <!-- id: 3 -->
    - [x] Change `/src/main.tsx` to `./src/main.tsx` in `index.html` <!-- id: 4 -->
- [x] Update Project Metadata <!-- id: 5 -->
    - [x] Add `homepage` to `package.json` <!-- id: 6 -->
- [x] Validation <!-- id: 7 -->
    - [x] Run `npm run build` and verify `dist/index.html` paths <!-- id: 8 -->
    - [x] Deploy and verify live site <!-- id: 9 -->
