# Proposal: Complete Localization and Intuitive Language Toggle

## Why
The current language toggle button is confusing: it shows the *target* language rather than the *current* language, which contradicts the user's expectation ("if button says Chinese, page should be Chinese"). Additionally, some UI elements in modals and settings might still be in English or hardcoded.

## What Changes
- Update the language toggle button to clearly indicate the active language.
- Ensure all modal elements (labels, placeholders, buttons) are correctly translated.
- Translate hardcoded market labels (TW, US, Crypto) into their localized versions.
- Ensure "Syncing", "Refreshing", and toast notifications are fully localized.

## Proposed Solution
- Change the language button to show the current language label (e.g., "中文" when in Chinese mode).
- Add missing translation keys to `translations.ts`.
- Update `AddAssetModal` and `EditAssetModal` to use localized market names and other missing translations.
- Update `App.tsx` header to reflect the new button logic.

## Goals
- Provide a more intuitive language switching experience.
- Achieve 100% localization for both English and Chinese users.
