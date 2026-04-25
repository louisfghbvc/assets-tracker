/**
 * Screenshot automation for docs/user-guide.md
 * Run: node scripts/take-screenshots.mjs
 * Requires: npm run dev running on port 1420
 */
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'docs', 'images');
const BASE = 'http://localhost:1420';

// iPhone 14 Pro dimensions
const MOBILE = { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true };

async function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function seedDatabase(page) {
  await page.evaluate(async () => {
    // Seed assets directly via Dexie (accessed through app bundle globals won't work,
    // so use raw IndexedDB API)
    const openDB = () => new Promise((resolve, reject) => {
      const req = indexedDB.open('AssetTrackerDB'); // no version = open at current version
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    const db = await openDB();

    const putAsset = (asset) => new Promise((resolve, reject) => {
      const tx = db.transaction('assets', 'readwrite');
      const store = tx.objectStore('assets');
      const req = store.add(asset);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    const putSellRecord = (record) => new Promise((resolve, reject) => {
      const tx = db.transaction('sellRecords', 'readwrite');
      const store = tx.objectStore('sellRecords');
      const req = store.add(record);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    const now = Date.now();

    // Clear existing data first
    await new Promise((resolve) => {
      const tx = db.transaction(['assets', 'sellRecords'], 'readwrite');
      tx.objectStore('assets').clear();
      tx.objectStore('sellRecords').clear();
      tx.oncomplete = resolve;
    });

    // Add mock assets
    await putAsset({
      recordId: 'rec-tsmc-001',
      symbol: '2330.TW',
      name: '台積電',
      type: 'stock',
      market: 'TW',
      quantity: 100,
      cost: 500,
      currentPrice: 650,
      lastUpdated: now,
      source: 'manual',
      purchaseDate: now - 90 * 24 * 60 * 60 * 1000,
    });

    await putAsset({
      recordId: 'rec-aapl-001',
      symbol: 'AAPL',
      name: 'Apple',
      type: 'stock',
      market: 'US',
      quantity: 10,
      cost: 150,
      currentPrice: 185,
      lastUpdated: now,
      source: 'manual',
      purchaseDate: now - 60 * 24 * 60 * 60 * 1000,
    });

    await putAsset({
      recordId: 'rec-btc-001',
      symbol: 'BTC-USDT',
      name: 'Bitcoin',
      type: 'crypto',
      market: 'Crypto',
      quantity: 0.5,
      cost: 50000,
      currentPrice: 62000,
      lastUpdated: now,
      source: 'manual',
      purchaseDate: now - 120 * 24 * 60 * 60 * 1000,
    });

    // Add a sell record for closed positions (NVDA fully sold)
    await putSellRecord({
      recordId: 'sell-nvda-001',
      symbol: 'NVDA',
      name: 'NVIDIA',
      market: 'US',
      soldQuantity: 5,
      avgCostAtSale: 400,
      sellPrice: 520,
      sellDate: now - 7 * 24 * 60 * 60 * 1000,
      purchaseDateSnapshot: now - 180 * 24 * 60 * 60 * 1000,
      holdingDays: 173,
      exchangeRateAtSale: 32.5,
      realizedGain: (520 - 400) * 5,
      realizedGainTWD: (520 - 400) * 5 * 32.5,
      fees: 0,
    });

    db.close();
  });
}

async function injectFakeAuth(page) {
  await page.addInitScript(() => {
    localStorage.setItem('google_access_token', 'fake_token_for_screenshots');
    localStorage.setItem('user_profile', JSON.stringify({
      name: 'Louis',
      email: 'louiliu@nvidia.com',
      picture: '',
    }));
    localStorage.setItem('app_language', 'zh');
  });
}

async function shot(page, filename, opts = {}) {
  const p = path.join(OUT, filename);
  await page.screenshot({ path: p, fullPage: opts.fullPage ?? false });
  console.log(`✓ ${filename}`);
}

async function waitForApp(page) {
  // Wait for React to mount — the balance element is a reliable signal
  await page.waitForSelector('[data-testid="total-balance"]', { timeout: 10000 }).catch(() => {
    // Might not have data yet — just wait for networkidle
  });
  await delay(800);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch({ headless: false, slowMo: 100 });

  // ─── CONTEXT 1: Empty state (for install screenshots) ────────────────────
  const emptyCtx = await browser.newContext({ viewport: MOBILE, deviceScaleFactor: 2, isMobile: true });
  const emptyPage = await emptyCtx.newPage();
  await injectFakeAuth(emptyPage);

  await emptyPage.goto(BASE);
  await emptyPage.waitForLoadState('networkidle');
  await delay(1000);

  // install-home.png — app homepage (login screen, before auth)
  // For this one we want the UNAUTHENTICATED login screen
  const loginCtx = await browser.newContext({ viewport: MOBILE, deviceScaleFactor: 2, isMobile: true });
  const loginPage = await loginCtx.newPage();
  await loginPage.goto(BASE);
  await loginPage.waitForLoadState('networkidle');
  await delay(800);
  await shot(loginPage, 'install-home.png');
  await loginCtx.close();

  // install-first-open.png — empty portfolio after login, before adding assets
  await shot(emptyPage, 'install-first-open.png');

  // add-asset-button.png — highlight the + button
  await shot(emptyPage, 'add-asset-button.png');

  // Open Add Asset modal
  await emptyPage.click('.add-btn');
  await delay(600);
  await shot(emptyPage, 'add-asset-form.png');

  // Fill in a realistic asset (台積電)
  // Market is TW by default
  await emptyPage.fill('input[placeholder]', '2330');
  await delay(1200); // wait for suggestions
  // Try clicking first suggestion if available, else just fill fields manually
  const suggestion = await emptyPage.$('.suggestion-item');
  if (suggestion) {
    await suggestion.click();
    await delay(400);
  } else {
    // fill name manually
    const nameInput = await emptyPage.$$('input[type="text"]');
    if (nameInput[1]) await nameInput[1].fill('台積電');
  }
  // Fill quantity
  const numInputs = await emptyPage.$$('input[type="number"]');
  await numInputs[0].fill('100');
  await numInputs[1].fill('500');
  await delay(400);
  await shot(emptyPage, 'add-asset-form.png'); // re-capture with filled values
  // Submit
  await emptyPage.click('.submit-btn');
  await delay(1000);
  await shot(emptyPage, 'add-asset-result.png');

  await emptyCtx.close();

  // ─── CONTEXT 2: Seeded portfolio ─────────────────────────────────────────
  const ctx = await browser.newContext({ viewport: MOBILE, deviceScaleFactor: 2, isMobile: true });
  const page = await ctx.newPage();
  await injectFakeAuth(page);

  // Navigate first to seed DB
  await page.goto(BASE);
  await page.waitForLoadState('networkidle');
  await delay(500);
  await seedDatabase(page);

  // Reload to pick up seeded data
  await page.reload();
  await page.waitForLoadState('networkidle');
  await delay(1200);

  // sync-button.png — top bar with cloud backup button visible
  await shot(page, 'sync-button.png');

  // sync-restore.png — same area showing restore button
  await shot(page, 'sync-restore.png');

  // Expand first asset to show sell button
  const firstAsset = await page.$('.asset-item');
  if (firstAsset) {
    await firstAsset.click();
    await delay(1000);

    // Scroll the sell button into view and screenshot
    const sellBtn = await page.$('.sell-item-btn');
    if (sellBtn) {
      await sellBtn.scrollIntoViewIfNeeded();
      await delay(500);
      await shot(page, 'sell-button.png');

      // Click sell to open modal
      await sellBtn.click();
      await delay(700);
      await shot(page, 'sell-form.png');

      // Close modal
      const closeBtn = await page.$('.modal-close-btn');
      if (closeBtn) {
        await closeBtn.click();
        await delay(400);
      }
    } else {
      await shot(page, 'sell-button.png');
    }
  }

  // Scroll to closed positions section
  const closedSection = await page.$('.closed-positions-section');
  if (closedSection) {
    await closedSection.scrollIntoViewIfNeeded();
    await delay(700);
    await shot(page, 'sell-closed.png');
  } else {
    // Fallback: scroll to bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await delay(600);
    await shot(page, 'sell-closed.png');
  }

  await ctx.close();
  await browser.close();

  console.log('\n✅ Automated screenshots done.');
  console.log('\n⚠️  Still needed (manual / real device):');
  console.log('   install-ios-1.png   — iPhone Safari share button');
  console.log('   install-ios-2.png   — "Add to Home Screen" option');
  console.log('   install-ios-3.png   — App icon on home screen');
  console.log('   install-android-1.png — Chrome install prompt banner');
  console.log('   install-android-2.png — After install');
  console.log('   sync-auth.png       — Google OAuth popup (real login required)');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
