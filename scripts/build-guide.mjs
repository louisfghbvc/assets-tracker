/**
 * Converts docs/user-guide.md → public/guide/index.html
 * Also copies docs/images/ → public/guide/images/
 * Run: node scripts/build-guide.mjs
 * Triggered by: npm run build / npm run dev (via prebuild/predev hooks)
 */
import { marked } from 'marked';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const MD_FILE = path.join(ROOT, 'docs', 'user-guide.md');
const OUT_DIR = path.join(ROOT, 'public', 'guide');
const IMAGES_SRC = path.join(ROOT, 'docs', 'images');
const IMAGES_DST = path.join(OUT_DIR, 'images');

const markdown = fs.readFileSync(MD_FILE, 'utf-8');
const body = marked.parse(markdown);

// Search JS uses indexOf (no regex on user input) to avoid template literal conflicts
const searchJS = `
    // Add ids to headings for anchor links
    document.querySelectorAll('h2,h3').forEach(function(h) {
      if (!h.id) {
        h.id = h.textContent.trim().toLowerCase()
          .replace(/[^a-z0-9\\u4e00-\\u9fff]+/g, '-').replace(/^-|-$/g, '');
      }
    });

    var input = document.getElementById('guide-search');
    var guideBody = document.getElementById('guide-body');
    var originalHTML = guideBody.innerHTML;

    function highlight(text, q) {
      var lower = text.toLowerCase();
      var lq = q.toLowerCase();
      var out = '', i = 0;
      while (i < text.length) {
        var j = lower.indexOf(lq, i);
        if (j === -1) { out += text.slice(i); break; }
        out += text.slice(i, j) + '<mark>' + text.slice(j, j + q.length) + '</mark>';
        i = j + q.length;
      }
      return out;
    }

    input.addEventListener('input', function() {
      var q = input.value.trim();
      if (!q) { guideBody.innerHTML = originalHTML; return; }
      var parts = originalHTML.split(/(<[^>]+>)/g);
      guideBody.innerHTML = parts.map(function(p) {
        return p.startsWith('<') ? p : highlight(p, q);
      }).join('');
      var first = guideBody.querySelector('mark');
      if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
`;

const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AssetTracker 使用教學</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg: #12121a;
      --surface: #1c1c28;
      --border: rgba(255,255,255,0.08);
      --text: #e2e8f0;
      --muted: #94a3b8;
      --accent: #60a5fa;
      --code-bg: rgba(255,255,255,0.07);
      --heading: #f1f5f9;
    }
    html { scroll-behavior: smooth; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 16px;
      line-height: 1.7;
      padding: 0 1rem 4rem;
    }
    .container { max-width: 680px; margin: 0 auto; }
    .search-bar {
      position: sticky;
      top: 0;
      background: var(--bg);
      padding: 0.75rem 0;
      margin-bottom: 1.5rem;
      border-bottom: 1px solid var(--border);
      z-index: 10;
    }
    .search-bar input {
      width: 100%;
      padding: 0.5rem 0.875rem;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      color: var(--text);
      font-size: 0.875rem;
      outline: none;
    }
    .search-bar input::placeholder { color: var(--muted); }
    .search-bar input:focus { border-color: var(--accent); }
    .app-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1.25rem 0 0.5rem;
    }
    .app-bar a { color: var(--accent); text-decoration: none; font-size: 0.875rem; }
    .app-bar a:hover { text-decoration: underline; }
    h1 { font-size: 1.6rem; color: var(--heading); margin: 1.5rem 0 0.5rem; }
    h2 { font-size: 1.2rem; color: var(--heading); margin: 2rem 0 0.75rem; padding-top: 1rem; border-top: 1px solid var(--border); scroll-margin-top: 80px; }
    h3 { font-size: 1rem; color: var(--heading); margin: 1.25rem 0 0.5rem; scroll-margin-top: 80px; }
    p { margin: 0.75rem 0; }
    a { color: var(--accent); }
    ul, ol { padding-left: 1.5rem; margin: 0.5rem 0; }
    li { margin: 0.25rem 0; }
    hr { border: none; border-top: 1px solid var(--border); margin: 1.5rem 0; }
    blockquote {
      border-left: 3px solid var(--accent);
      padding: 0.5rem 1rem;
      margin: 1rem 0;
      background: var(--surface);
      border-radius: 0 8px 8px 0;
      color: var(--muted);
    }
    blockquote strong { color: var(--text); }
    code {
      background: var(--code-bg);
      padding: 0.1em 0.4em;
      border-radius: 4px;
      font-family: 'SF Mono', 'Fira Mono', monospace;
      font-size: 0.85em;
    }
    pre { background: var(--code-bg); padding: 1rem; border-radius: 8px; overflow-x: auto; margin: 1rem 0; }
    pre code { background: none; padding: 0; }
    img { width: 100%; border-radius: 12px; margin: 0.75rem 0; border: 1px solid var(--border); }
    strong { color: var(--heading); }
    mark { background: rgba(96,165,250,0.35); color: inherit; border-radius: 2px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="app-bar">
      <span style="color:var(--muted);font-size:0.8rem">AssetTracker 使用教學</span>
      <a href="../">← 返回 App</a>
    </div>
    <div class="search-bar">
      <input type="search" id="guide-search" placeholder="搜尋教學內容…" autocomplete="off">
    </div>
    <div id="guide-body">
${body}
    </div>
  </div>
  <script>${searchJS}</script>
</body>
</html>`;

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'index.html'), html, 'utf-8');
console.log('✓ public/guide/index.html written');

if (fs.existsSync(IMAGES_SRC)) {
  fs.mkdirSync(IMAGES_DST, { recursive: true });
  fs.cpSync(IMAGES_SRC, IMAGES_DST, { recursive: true });
  console.log('✓ docs/images/ copied → public/guide/images/');
}

console.log('✓ Guide build complete');
