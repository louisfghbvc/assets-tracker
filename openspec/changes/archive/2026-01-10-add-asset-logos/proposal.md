# Proposal: Add Asset Logos to List Items

## Why
Currently, the asset tracker uses generic icons (TrendingUp, Wallet) for all assets. Adding specific brand logos (like NVIDIA, Apple, Bitcoin) makes the interface look more professional and allows users to identify their holdings faster, similar to premium platforms like TradingView.

## What Changes
- Implement a dynamic logo fetching mechanism in the asset list.
- Use public, free CDNs for stock and cryptocurrency logos.
- Add an `onError` fallback to ensure that if a logo is missing, the UI still displays a valid icon.
- Update the `asset-item` component to prioritize the brand logo over the generic icon.

## Goals
- Enhance visual appeal and brand recognition.
- Provide a "premium" feel to the asset list.
- Maintain robustness through automatic fallbacks.

## Non-Goals
- Hosting a private database of company logos.
- Manual management of logo images.
