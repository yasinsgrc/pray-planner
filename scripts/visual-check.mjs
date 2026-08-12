// Real headless-browser verification: navigates the built app, screenshots
// all 4 tabs under 2 fixed-time scenarios (öğle/light, yatsı/dark), and
// asserts real DOM measurements instead of trusting that a clean
// `tsc`/`build` means the UI actually looks right. See design-refresh-v3
// Faz 0 — runtime breakage is invisible to the type checker and bundler.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdir, readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import sharp from 'sharp';

const PORT = 4174;
const BASE_URL = `http://localhost:${PORT}`;
// A second, deliberately dumb static server (design-refresh-v3 Faz 9 Final)
// — `vite preview` always has *some* server behind it, so it can't stand in
// for a genuinely serverless deploy (Netlify etc., no /api/*, no /health).
// This one mimics that: serves dist/ with an SPA fallback, and either 404s
// /health + /api/* (matching netlify.toml) or, in "SPA fallback" mode,
// deliberately does NOT — answering everything including /health with 200 +
// index.html, the exact failure mode design-refresh-v3 Faz 9 M1 fixed.
const STATIC_PORT = 4175;
const STATIC_BASE_URL = `http://localhost:${STATIC_PORT}`;
const OUT_DIR = path.resolve('.visual');
const COUNTDOWN_MAX_WIDTH = 210;
const MIN_TOUCH_TARGET = 44;
const CONTRAST_MIN_NORMAL = 4.5;
const CONTRAST_MIN_LARGE = 3.0;
// Raw Tailwind palette utilities bypass the theme system entirely (no
// --v-*/--gold/--success/--danger token, so no dark-mode or contrast
// coverage) — design-refresh-v3 Faz 3 F2, where a badge using one of
// these measured 1.11:1 and had never been checked. Word-boundary so it
// doesn't also flag e.g. "grayscale" or unrelated identifiers.
const FORBIDDEN_COLOR_PATTERN =
  /\b(?:text|bg|border|divide|ring|from|via|to|fill|stroke|outline|accent|caret|decoration|shadow)-(?:emerald|red|gray|slate|zinc|neutral|blue|amber)-\d{2,3}\b/;
// A dative-case suffix ('de/'da/'te/'ta/'ye/'ya) hardcoded directly after an
// interpolated/JSX expression is wrong for most values: Turkish vowel
// harmony + consonant assimilation pick the correct suffix letter based on
// the last sound of the actual word, which a fixed literal can't know in
// advance (design-refresh-v3 Faz 1 F-akşam and Faz 5 F2 — both were exactly
// this: a formatted clock time or variable followed by a fixed suffix,
// wrong for all but a few coincidental values). The fix is always to
// rephrase around the suffix, never to hardcode one after a dynamic value.
// Anchored on a closing `}` (optionally followed by a JSX closing tag) so
// fixed, already-correct dative forms on literal words (e.g. "Pazartesi'ye",
// prayerCalculator.ts's PRAYER_LABEL_DATIVE table) don't false-positive.
const DATIVE_SUFFIX_PATTERN = /\}(?:<\/[a-zA-Z][\w.]*>)?'(?:de|da|te|ta|ye|ya)\b/;

// WCAG relative luminance / contrast ratio (design-refresh-v3 Faz 2 F1).
function relLuminance([r, g, b]) {
  const lin = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrastRatio(rgbA, rgbB) {
  const lA = relLuminance(rgbA);
  const lB = relLuminance(rgbB);
  const lighter = Math.max(lA, lB);
  const darker = Math.min(lA, lB);
  return (lighter + 0.05) / (darker + 0.05);
}

const TABS = [
  { id: 'focus', label: 'Ana Ekran' },
  { id: 'flow', label: 'Vakitler' },
  { id: 'spiritual', label: 'Maneviyat' },
  { id: 'settings', label: 'Ayarlar' },
];

const SCENARIOS = [
  { name: 'ogle', time: '2026-08-01T13:30:00' },
  { name: 'yatsi', time: '2026-08-01T00:45:00' },
];

const violations = [];

function run(cmd, args, envOverrides = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', shell: true, env: { ...process.env, ...envOverrides } });
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
  });
}

function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryConnect = () => {
      http
        .get(url, (res) => {
          res.resume();
          resolve();
        })
        .on('error', () => {
          if (Date.now() - start > timeoutMs) reject(new Error('preview server did not start in time'));
          else setTimeout(tryConnect, 300);
        });
    };
    tryConnect();
  });
}

function describeElement(className) {
  return className && typeof className === 'string' ? className.split(' ').slice(0, 4).join('.') : String(className);
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.ico': 'image/x-icon',
};

/**
 * A deliberately dumb static file server standing in for a real serverless
 * host (Netlify etc.) — see the STATIC_PORT comment above for why
 * `vite preview` can't be reused for this. `mimicBrokenSpaFallback: true`
 * skips the /health + /api/* 404 rules entirely, falling through to the
 * catch-all SPA fallback for those paths too — the exact misconfiguration
 * design-refresh-v3 Faz 9 M1's client-side check must survive on its own.
 */
function createStaticServer(distDir, { mimicBrokenSpaFallback = false } = {}) {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const pathname = url.pathname;

    if (!mimicBrokenSpaFallback && (pathname === '/health' || pathname.startsWith('/api/'))) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Not found' }));
      return;
    }

    let filePath = path.join(distDir, decodeURIComponent(pathname));
    try {
      const info = await stat(filePath);
      if (info.isDirectory()) filePath = path.join(filePath, 'index.html');
      await stat(filePath);
    } catch {
      filePath = path.join(distDir, 'index.html'); // SPA fallback
    }

    try {
      const data = await readFile(filePath);
      res.statusCode = 200;
      res.setHeader('Content-Type', MIME_TYPES[path.extname(filePath)] ?? 'application/octet-stream');
      res.end(data);
    } catch {
      res.statusCode = 404;
      res.end('Not found');
    }
  });
}

function listenOnce(server, port) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, () => resolve());
  });
}

function closeServer(server) {
  return new Promise((resolve) => server.close(() => resolve()));
}

/**
 * Static scan (no browser needed): every .ts/.tsx file under src/ must
 * have zero raw Tailwind palette utilities (design-refresh-v3 Faz 3 F2).
 * Colors belong in src/index.css as a themed CSS custom property (one of
 * --v-*, --gold, --success, --danger); anything else silently skips
 * dark-mode and contrast coverage.
 */
async function scanForbiddenColors(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await scanForbiddenColors(full);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry.name)) continue;
    const text = await readFile(full, 'utf8');
    const lines = text.split('\n');
    lines.forEach((line, i) => {
      const match = line.match(FORBIDDEN_COLOR_PATTERN);
      if (match) {
        violations.push(
          `[static] raw Tailwind color class in ${path.relative(process.cwd(), full)}:${i + 1} — "${match[0]}" (use a --v-*/--gold/--success/--danger token instead)`
        );
      }
      const dativeMatch = line.match(DATIVE_SUFFIX_PATTERN);
      if (dativeMatch) {
        violations.push(
          `[static] hardcoded dative suffix after a dynamic value in ${path.relative(process.cwd(), full)}:${i + 1} — "${dativeMatch[0]}" (rephrase to avoid a suffix on a variable/formatted value instead)`
        );
      }
    });
  }
}

/**
 * design-refresh-v3 Faz 24 Commit 2 — a fixed `waitForTimeout(300)` after
 * Escape-closing a BottomSheet is racy: BottomSheet's exit uses a spring
 * transition (damping 32, stiffness 320, no fixed duration), and
 * AnimatePresence only unmounts the sheet once that spring settles. Caught
 * via a real failure: querying `document.querySelectorAll('button')`
 * mid-spring returned still-attached-but-about-to-unmount elements from the
 * closing sheet, which then detached from the DOM while the subsequent
 * trial-click loop was still iterating over them ("Element is not attached
 * to the DOM"). Poll for the sheet's [role="dialog"] to actually leave the
 * DOM instead of guessing a fixed delay.
 */
async function waitForDialogClosed(page, timeoutMs = 2000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (!(await page.evaluate(() => !!document.querySelector('[role="dialog"]')))) return true;
    await page.waitForTimeout(50);
  }
  return false;
}

/**
 * Touch target size AND real hit-testing — every visible, enabled
 * clickable control must measure >=44x44 (its own box, or a ::before
 * expansion, read per-side since some expansions are asymmetric — e.g.
 * DailyInspirationCard's tabs expand top/bottom by more than left/right —
 * design-refresh-v3 Faz 3 F1/F4) AND every point in that claimed box must
 * actually elementFromPoint back to the control itself. Computed CSS
 * geometry alone isn't proof of a real tap target: two controls' invisible
 * ::before zones can overlap (design-refresh-v3 Faz 3 F4), and in the
 * overlap band a tap silently routes to whichever element is later in
 * paint order — this only shows up by actually hit-testing, the same way
 * elementFromPoint-based auditing found it in the first place. Called both
 * at the normal 390px width and again at 320px, since an overlap that
 * doesn't exist at 390 can appear once controls sit closer together.
 */
async function checkTouchTargets(page, scenario, screenId) {
  const touchIssues = await page.evaluate((MIN) => {
    const issues = [];
    const clickable = Array.from(
      document.querySelectorAll('button:not([disabled]), a[href], [role="button"]:not([aria-disabled="true"])')
    ).filter((el) => !el.closest('[inert]'));

    clickable.forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;
      const style = getComputedStyle(el, '::before');
      let box = { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
      if (style.content !== 'none' && style.position === 'absolute') {
        const t = parseFloat(style.top) || 0;
        const b = parseFloat(style.bottom) || 0;
        const l = parseFloat(style.left) || 0;
        const r = parseFloat(style.right) || 0;
        box = {
          left: rect.left + Math.min(l, 0),
          right: rect.right - Math.min(r, 0),
          top: rect.top + Math.min(t, 0),
          bottom: rect.bottom - Math.min(b, 0),
        };
      }
      const effectiveW = box.right - box.left;
      const effectiveH = box.bottom - box.top;
      if (effectiveW < MIN || effectiveH < MIN) {
        issues.push({
          kind: 'size',
          tag: el.tagName,
          cls: el.className,
          label: el.getAttribute('aria-label') || el.textContent?.trim().slice(0, 30),
          w: effectiveW,
          h: effectiveH,
        });
        return; // too small to begin with — skip the overlap probe below
      }

      // Real hit-test: sample corners (inset 1px so we're inside the box,
      // not exactly on its boundary line) and edge midpoints.
      const insetX = Math.min(1, effectiveW / 2 - 0.5);
      const insetY = Math.min(1, effectiveH / 2 - 0.5);
      const points = [
        [box.left + insetX, box.top + insetY],
        [box.right - insetX, box.top + insetY],
        [box.left + insetX, box.bottom - insetY],
        [box.right - insetX, box.bottom - insetY],
        [(box.left + box.right) / 2, box.top + insetY],
        [(box.left + box.right) / 2, box.bottom - insetY],
        [box.left + insetX, (box.top + box.bottom) / 2],
        [box.right - insetX, (box.top + box.bottom) / 2],
      ];
      for (const [px, py] of points) {
        const hit = document.elementFromPoint(px, py);
        if (!hit) continue;
        if (hit === el || el.contains(hit)) continue;
        // The fixed bottom Navbar is a deliberate glass-panel overlay that
        // sits atop whatever content happens to be scrolled to that screen
        // position — same as any fixed bottom-tab-bar app (iOS/Android):
        // content geometrically under it at a given scroll offset is
        // normal, not a collision between two controls, and scrolling a
        // little brings it fully clear. Only flag overlaps between two
        // controls that are both part of the actual page content.
        if (hit.closest('[role="tablist"]')) continue;
        const hitControl = hit.closest('button, a[href], [role="button"]');
        if (hitControl && hitControl !== el) {
          issues.push({
            kind: 'overlap',
            tag: el.tagName,
            cls: el.className,
            label: el.getAttribute('aria-label') || el.textContent?.trim().slice(0, 30),
            stolenBy: hitControl.getAttribute('aria-label') || hitControl.textContent?.trim().slice(0, 30),
            diag: {
              elRect: el.getBoundingClientRect(),
              box,
              probePoint: [px, py],
              hitControlRect: hitControl.getBoundingClientRect(),
              mainScrollTop: document.querySelector('main')?.scrollTop,
            },
          });
          break;
        }
      }
    });
    return issues;
  }, MIN_TOUCH_TARGET);
  for (const issue of touchIssues) {
    if (issue.kind === 'size') {
      violations.push(
        `[${scenario.name}/${screenId}] touch target too small: <${issue.tag} class="${describeElement(issue.cls)}"` +
          ` label="${issue.label}"> ${issue.w.toFixed(0)}x${issue.h.toFixed(0)}px < ${MIN_TOUCH_TARGET}x${MIN_TOUCH_TARGET}px`
      );
    } else {
      violations.push(
        `[${scenario.name}/${screenId}] overlapping tap zone: <${issue.tag} class="${describeElement(issue.cls)}"` +
          ` label="${issue.label}"> a point inside its own hit box resolves to "${issue.stolenBy}" instead`
      );
      if (process.env.VAKIT_DIAGNOSE_OVERLAP) {
        console.log('  [OVERLAP DIAG]', JSON.stringify(issue.diag));
      }
    }
  }
}

/**
 * Runs the full generic assertion suite (screenshot, overflow, button
 * clickability, touch-target size, text contrast) against whatever is
 * currently rendered — used for every tab AND for standalone screens like
 * the Zikirmatik and Destek Ol sheets, which aren't tabs and would
 * otherwise never be exercised by the per-tab loop.
 */
async function checkScreen(page, scenario, screenId) {
  // FadeIn sections use motion's whileInView (IntersectionObserver), which
  // only fires on a real scroll — Chromium's fullPage capture (CDP
  // captureBeyondViewport) never scrolls, so below-the-fold FadeIn content
  // stays stuck at its initial opacity:0 forever in both the saved
  // screenshot and any measurement taken after it. A real user scrolling
  // down triggers it normally; simulate that once per screen
  // (viewport:{once:true} means it then stays revealed even after
  // scrolling back to the top for the rest of the checks). Scrolls the
  // currently relevant scroll container, not window — since design-refresh-v3
  // Faz 24 Commit 1, html/body are overflow:hidden, so window.scrollTo is a
  // no-op. When a BottomSheet is open (screens like hakkinda/lisanslar/
  // destek/geri-bildirim), <main> sits inert behind it and isn't what the
  // user is actually looking at — the sheet's own [role="dialog"] .overflow-y-auto
  // div is the real scroll container for that screen's FadeIn content.
  await page.evaluate(() => {
    const el = document.querySelector('[role="dialog"] .overflow-y-auto') ?? document.querySelector('main');
    if (el) el.scrollTop = el.scrollHeight;
  });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    const el = document.querySelector('[role="dialog"] .overflow-y-auto') ?? document.querySelector('main');
    if (el) el.scrollTop = 0;
  });

  const screenshotPath = path.join(OUT_DIR, `${scenario.name}-${screenId}.png`);
  // fullPage screenshots "stamp" position:fixed elements (the Navbar) at
  // every viewport-height interval down the page — a Playwright/Chromium
  // capture artifact, not something a real scrolling user sees (the fixed
  // navbar only ever renders once, pinned to the viewport bottom). Hide it
  // just for the capture.
  await page.addStyleTag({ content: '[role="tablist"] { visibility: hidden !important; }' });
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await page.evaluate(() => {
    document.querySelectorAll('style').forEach((el) => {
      if (el.textContent.includes('role="tablist"')) el.remove();
    });
  });
  console.log(`  Saved ${screenshotPath}`);

  // 1 & 2: off-screen / overflowing elements
  const overflowIssues = await page.evaluate(() => {
    const issues = [];
    const clientWidth = document.documentElement.clientWidth;
    document.querySelectorAll('body *').forEach((el) => {
      if (el.classList.contains('sr-only')) return;
      // Content behind an open BottomSheet is marked inert (see
      // BottomSheet.tsx) — real users can't see or reach it, so measuring
      // it here would just be checking a state nobody experiences.
      if (el.closest('[inert]')) return;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;
      if (rect.right > clientWidth) {
        issues.push({ kind: 'right-overflow', tag: el.tagName, cls: el.className, value: rect.right, clientWidth });
      }
      if (rect.left < 0) {
        issues.push({ kind: 'left-overflow', tag: el.tagName, cls: el.className, value: rect.left });
      }
      if (el.scrollWidth > clientWidth + 2) {
        issues.push({ kind: 'scroll-overflow', tag: el.tagName, cls: el.className, value: el.scrollWidth, clientWidth });
      }
    });
    return issues;
  });
  for (const issue of overflowIssues) {
    violations.push(
      `[${scenario.name}/${screenId}] ${issue.kind}: <${issue.tag} class="${describeElement(issue.cls)}"> ` +
        `value=${issue.value.toFixed?.(1) ?? issue.value} clientWidth=${issue.clientWidth ?? 'n/a'}`
    );
  }

  // 3: every visible, enabled button is actually clickable (no pointer-events
  // blocker on top). Explicitly-disabled buttons (e.g. PrayerTracker's future
  // prayers) are SUPPOSED to reject clicks — that's not a bug to flag, and
  // neither is a button behind an open BottomSheet's inert backdrop.
  const buttons = await page.$$('button:visible:not([disabled])');
  for (const handle of buttons) {
    if (await handle.evaluate((el) => !!el.closest('[inert]'))) continue;
    try {
      await handle.click({ trial: true, timeout: 2000 });
    } catch (err) {
      const info = await handle.evaluate(
        (el) => `aria-label="${el.getAttribute('aria-label') ?? ''}" class="${el.className}"`
      );
      violations.push(
        `[${scenario.name}/${screenId}] button not clickable: <button ${info}> — ${String(err.message).split('\n')[0]}`
      );
    }
  }

  // design-refresh-v3 Faz 24 Commit 1 — step 3's click({trial:true}) makes
  // Playwright scroll the real scroll container (<main>, or a BottomSheet's
  // own overflow-y-auto div when one is open — see src/index.css/App.tsx)
  // into view for whatever button it last had to reach, leaving it scrolled
  // by the time this runs. Header deliberately stays outside <main>'s
  // scroll region (that's the whole point of the single-scroll-container
  // fix), so a scrolled <main> shifts early list rows up into Header's
  // on-screen position — a false-positive "overlap" that's an artifact of
  // this check's own leftover scroll state, not a real app bug (confirmed:
  // mainScrollTop was 434 when caught via VAKIT_DIAGNOSE_OVERLAP). It would
  // also desync step 5's contrast pixel-sampling from the screenshot taken
  // back at step 0, which was captured at scrollTop 0. Reset before both.
  await page.evaluate(() => {
    const el = document.querySelector('[role="dialog"] .overflow-y-auto') ?? document.querySelector('main');
    if (el) el.scrollTop = 0;
  });

  // 4: touch target size and real hit-testing.
  await checkTouchTargets(page, scenario, screenId);

  // 5: text contrast — every visible text-bearing element must clear WCAG
  // AA (4.5:1 normal text, 3.0:1 for >=24px or >=18.66px bold). Background
  // is determined by pixel-sampling a real screenshot (not by reasoning
  // about color-mix/opacity in isolation): every text-bearing element's
  // own color is set to transparent, a fullPage screenshot is taken, and
  // the pixel(s) behind each element's box are sampled from that
  // screenshot — so translucent layers, color-mix backgrounds, and glass
  // blur are already fully resolved by the browser's own compositor by
  // the time we sample.
  await page.evaluate(() => window.scrollTo(0, 0));
  const { elements: textEls, skippedClippedCount } = await page.evaluate(() => {
    const results = [];
    // Canvas fillStyle resolves ANY valid CSS color syntax (oklch(),
    // rgb(), hex, color-mix()...) to concrete 8-bit sRGB — regexing
    // getComputedStyle's raw string is not safe: Tailwind v4's default
    // palette (e.g. emerald-*) is OKLCH-defined, and Chromium serializes
    // getComputedStyle().color as "oklch(...)" for those, which an
    // rgb()-only regex silently misreads as black.
    const probe = document.createElement('canvas');
    probe.width = 1;
    probe.height = 1;
    const pctx = probe.getContext('2d');
    const resolveColor = (str) => {
      pctx.clearRect(0, 0, 1, 1);
      pctx.fillStyle = str;
      pctx.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = pctx.getImageData(0, 0, 1, 1).data;
      return { r, g, b, a: a / 255 };
    };
    // An element scrolled out of view inside an `overflow-y-auto` ancestor
    // (e.g. a long BottomSheet body — the privacy policy is the first
    // content in this app tall enough to trigger it) still has a real,
    // unclipped getBoundingClientRect() — its layout position doesn't
    // change just because a clipping ancestor paints nothing there. Pixel
    // sampling that position on the fullPage screenshot reads whatever
    // happens to be at that pixel for a *different* reason (page edge
    // clamp, unrelated content behind the sheet) — not the text's real
    // background, which no user ever sees since the text itself isn't
    // painted there. Skip anything geometrically outside a clipping
    // ancestor's own visible box (design-refresh-v3 Faz 10 — found via a
    // real computed-style probe: 12.57:1 actual contrast for text pixel-
    // sampled at 2.69:1).
    let skippedClippedCount = 0;
    const isClippedByScrollableAncestor = (el) => {
      const rect = el.getBoundingClientRect();
      let node = el.parentElement;
      while (node && node !== document.body) {
        const cs = getComputedStyle(node);
        if (cs.overflowY === 'auto' || cs.overflowY === 'scroll' || cs.overflowX === 'auto' || cs.overflowX === 'scroll') {
          const cRect = node.getBoundingClientRect();
          if (rect.bottom <= cRect.top || rect.top >= cRect.bottom || rect.right <= cRect.left || rect.left >= cRect.right) {
            skippedClippedCount += 1;
            return true;
          }
        }
        node = node.parentElement;
      }
      return false;
    };
    document.querySelectorAll('body *').forEach((el, index) => {
      if (el.classList.contains('sr-only')) return;
      if (el.closest('[disabled], [aria-disabled="true"]')) return;
      if (el.closest('[inert]')) return;
      // The fixed bottom Navbar is excluded for the same reason it's
      // hidden for the saved screenshot: a fullPage capture stitches
      // position:fixed elements against document-flow content that isn't
      // actually behind them for a real scrolling user, so any pixel
      // sampled "through" its glass-panel blur here would be sampling a
      // background that doesn't correspond to reality.
      if (el.closest('[role="tablist"]')) return;
      if (isClippedByScrollableAncestor(el)) return;
      const hasDirectText = Array.from(el.childNodes).some(
        (n) => n.nodeType === 3 && n.textContent.trim().length > 0
      );
      if (!hasDirectText) return;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      if (rect.bottom < 0 || rect.top > window.innerHeight * 50) return;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') return;
      const tag = `__contrast_${index}`;
      el.setAttribute('data-contrast-probe', tag);
      results.push({
        probe: tag,
        kind: 'text',
        tag: el.tagName,
        cls: el.className,
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        color: resolveColor(cs.color),
        opacity: parseFloat(cs.opacity) || 1,
        fontSize: parseFloat(cs.fontSize) || 16,
        fontWeight: parseFloat(cs.fontWeight) || 400,
      });
    });

    // Icons (WCAG 1.4.11, 3:1 threshold — a fixed floor regardless of
    // size, unlike text's size-dependent 4.5/3.0 split). Phosphor icons
    // are <svg><path fill="currentColor"/></svg>, so the icon's real
    // color is the svg element's own inherited `color`, same mechanism as
    // text — hiding/sampling it works identically to the text pass above.
    document.querySelectorAll('svg').forEach((el, index) => {
      if (el.closest('[disabled], [aria-disabled="true"]')) return;
      if (el.closest('[inert]')) return;
      if (el.closest('[role="tablist"]')) return;
      if (isClippedByScrollableAncestor(el)) return;
      // Only Phosphor-generated icons (which always set fill="currentColor"
      // on the <svg> root) are checked this way. Hand-authored SVGs like
      // ZikirmatikModal's progress ring set stroke directly on their
      // <circle> children with a fixed color unrelated to the svg's own
      // inherited `color` — hiding/sampling via color:transparent does
      // nothing for those, so treat them as out of scope here rather than
      // measure something that was never actually the rendered pixel.
      if (el.getAttribute('fill') !== 'currentColor') return;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      if (rect.bottom < 0 || rect.top > window.innerHeight * 50) return;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') return;
      const color = resolveColor(cs.color);
      const opacity = parseFloat(cs.opacity) || 1;
      // A deliberately faded/watermark icon (e.g. a large background
      // Quotes glyph at 15% opacity) isn't the "graphical object required
      // to understand content" 1.4.11 is about — skip anything already
      // faded past being a meaningful foreground indicator.
      if (color.a * opacity < 0.6) return;
      const tag = `__contrast_icon_${index}`;
      el.setAttribute('data-contrast-probe', tag);
      results.push({
        probe: tag,
        kind: 'icon',
        tag: 'svg',
        cls: el.getAttribute('class') || '',
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        color,
        opacity,
        fontSize: 0,
        fontWeight: 0,
      });
    });

    // Hide after collecting so every probe uses the same unmodified layout.
    results.forEach(({ probe }) => {
      const el = document.querySelector(`[data-contrast-probe="${probe}"]`);
      el.style.setProperty('color', 'transparent', 'important');
    });
    return { elements: results, skippedClippedCount };
  });

  // Logged unconditionally (not just when >0) so a future regression that
  // starts clipping-skipping *everything* (e.g. a CSS change that makes
  // overflow: auto ambient on some outer wrapper) is visible in the run
  // output instead of silently passing with an empty, all-skipped element
  // set (design-refresh-v3 Faz 10 — this exact check exists because a
  // clipped element was wrongly contrast-sampled in the first place).
  console.log(`  ${skippedClippedCount} element(s) skipped as clipped-out-of-view by a scrollable ancestor.`);

  if (textEls.length > 0) {
    const dpr = await page.evaluate(() => window.devicePixelRatio);
    // Same fullPage-stitching artifact as the saved screenshot: the fixed
    // Navbar must be hidden here too, or it gets stamped over
    // document-flow content near the first-viewport-height mark and
    // corrupts background sampling for whatever real element sits "under"
    // that stamped copy (not under the real, once-only navbar a scrolling
    // user actually sees).
    await page.addStyleTag({ content: '[role="tablist"] { visibility: hidden !important; }' });
    // Same fullPage-stitching hazard as the tablist above, newly triggered
    // by design-refresh-v3 Faz 23's longer Licenses list: BottomSheet's
    // fixed inset-0 backdrop (bg-black/40) can get stamped near a stitch
    // boundary and corrupt the background sample for whatever real content
    // sits there (measured: text-mist-on-bg-card is a real 5.41:1, not the
    // corrupted ~1.79:1 this produced before this fix).
    await page.addStyleTag({ content: '[data-sheet-backdrop] { visibility: hidden !important; }' });
    // Elements with a `transition-colors` class (e.g. SegmentedControl)
    // don't apply color:transparent instantly — the change is the start
    // of a CSS transition, so a screenshot taken without waiting for a
    // repaint still shows the pre-hide color. Force every transition to
    // be instant for this capture only.
    await page.addStyleTag({ content: '* { transition: none !important; }' });
    // transition:none only stops CSS transitions — a Framer Motion
    // layoutId spring (e.g. SegmentedControl's selected pill) is driven by
    // JS/rAF and can still be mid-flight for its full ~350ms+bounce
    // settle time regardless, occasionally landing the pill a few px off
    // its rest position at the exact capture instant and sampling a
    // corner/edge pixel instead of solid fill (measured flake: SegmentedControl
    // contrast reads correctly on every immediate re-run). Give it margin.
    await page.waitForTimeout(400);
    const shot = await page.screenshot({ fullPage: true });
    await page.evaluate(() => {
      document.querySelectorAll('[data-contrast-probe]').forEach((el) => {
        el.style.removeProperty('color');
        el.removeAttribute('data-contrast-probe');
      });
      document.querySelectorAll('style').forEach((el) => {
        if (el.textContent.includes('role="tablist"') || el.textContent.includes('transition: none')) {
          el.remove();
        }
      });
    });

    const { data, info } = await sharp(shot).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const samplePixel = (px, py) => {
      const x = Math.min(Math.max(Math.round(px), 0), info.width - 1);
      const y = Math.min(Math.max(Math.round(py), 0), info.height - 1);
      const i = (y * info.width + x) * info.channels;
      return [data[i], data[i + 1], data[i + 2]];
    };

    for (const t of textEls) {
      const cx = (t.rect.x + t.rect.width / 2) * dpr;
      const cy = (t.rect.y + t.rect.height / 2) * dpr;
      // Kept well inside the box (not near corners/edges, which can be
      // antialiased or fall outside a rounded-corner background like a
      // selected SegmentedControl pill) so every sample lands on the same
      // surface as the glyphs themselves did.
      const offsets = [
        [0, 0],
        [-t.rect.width * 0.2 * dpr, 0],
        [t.rect.width * 0.2 * dpr, 0],
        [0, -t.rect.height * 0.15 * dpr],
        [0, t.rect.height * 0.15 * dpr],
      ];
      const samples = offsets.map(([dx, dy]) => samplePixel(cx + dx, cy + dy));
      const median = (arr) => {
        const s = [...arr].sort((a, b) => a - b);
        return s[Math.floor(s.length / 2)];
      };
      const bg = [0, 1, 2].map((ch) => median(samples.map((s) => s[ch])));

      const parsed = t.color;
      const alpha = (parsed.a ?? 1) * t.opacity;
      const effective = [
        bg[0] + (parsed.r - bg[0]) * alpha,
        bg[1] + (parsed.g - bg[1]) * alpha,
        bg[2] + (parsed.b - bg[2]) * alpha,
      ];

      const ratio = contrastRatio(effective, bg);
      // Icons: WCAG 1.4.11 non-text contrast is a flat 3:1, no size split.
      const isLarge = t.fontSize >= 24 || (t.fontSize >= 18.66 && t.fontWeight >= 700);
      const minRatio = t.kind === 'icon' ? CONTRAST_MIN_LARGE : isLarge ? CONTRAST_MIN_LARGE : CONTRAST_MIN_NORMAL;
      if (ratio < minRatio) {
        const detail =
          t.kind === 'icon' ? '(icon, 1.4.11)' : `(fontSize=${t.fontSize.toFixed(0)}px weight=${t.fontWeight})`;
        violations.push(
          `[${scenario.name}/${screenId}] low contrast: <${t.tag} class="${describeElement(t.cls)}"> ` +
            `${ratio.toFixed(2)}:1 < ${minRatio}:1 ${detail}`
        );
      }
    }
  }
}

/**
 * Offline support (design-refresh-v3 Faz 4 F1) — prayer times are computed
 * entirely on-device from lat/lng (adhan), so once the app shell itself is
 * cached, there is nothing left that requires a network connection for the
 * core experience. Verifies the service worker actually precaches and
 * serves that shell: register, reload so the page becomes controlled, go
 * offline, reload again, and confirm the countdown and all 4 tabs still
 * render — not just that the network layer didn't throw.
 */
async function checkOfflineSupport(browser) {
  console.log('\n=== Offline support ===');
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    locale: 'tr-TR',
    timezoneId: 'Europe/Istanbul',
  });
  let page;
  try {
    const onlinePage = await context.newPage();
    onlinePage.setDefaultTimeout(15000);
    await onlinePage.goto(BASE_URL, { waitUntil: 'load', timeout: 20000 });
    await onlinePage.evaluate(() => navigator.serviceWorker.ready);

    // The very first load of a page is never controlled by a worker it
    // just registered (per spec) — only the next navigation is.
    await onlinePage.reload({ waitUntil: 'load', timeout: 20000 });
    const controlled = await onlinePage.evaluate(() => !!navigator.serviceWorker.controller);
    if (!controlled) {
      violations.push(
        '[offline] page is not controlled by the service worker after a reload — offline support cannot work'
      );
      return;
    }
    await onlinePage.close();

    await context.setOffline(true);

    // A reload of the SAME page can pass even with a broken cache: Chromium's
    // own HTTP cache (separate from the Service Worker's Cache Storage) can
    // still be warm for that exact document and its sub-resources, hiding a
    // real fetch-handler bug (design-refresh-v3 Faz 5 F1 — the SW couldn't
    // find its own cache after a genuinely cold start, but a reload-based
    // check here still passed). A brand new page in the same context (SW
    // registration + Cache Storage persist; a never-before-loaded page has
    // no warm HTTP cache to fall back on) forces every request through the
    // SW's actual fetch handler.
    page = await context.newPage();
    page.setDefaultTimeout(15000);
    const failedRequests = [];
    page.on('requestfailed', (req) => {
      const url = req.url();
      // /api/* and /health are deliberately never cached (see public/sw.js,
      // design-refresh-v3 Faz 9 F2) — the app already falls back to its
      // static content pool silently when /api/* is unreachable, and
      // useApiAvailable already treats a failed /health fetch as "no
      // server" (checkApiAvailable's catch block), so a failure on either
      // here is expected, not a cache regression.
      if (!url.includes('/api/') && !url.endsWith('/health')) failedRequests.push(url);
    });
    await page.goto(BASE_URL, { waitUntil: 'load', timeout: 20000 });

    const countdownText = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="countdown"]');
      return el ? el.textContent.trim() : null;
    });
    if (!countdownText || !/\d/.test(countdownText)) {
      violations.push(`[offline] countdown did not render while offline (got "${countdownText}")`);
    }

    for (const tab of TABS) {
      await page.getByRole('tab', { name: tab.label }).click();
      await page.waitForTimeout(300);
      const textLength = await page.evaluate(() => document.body.innerText.trim().length);
      if (textLength < 50) {
        violations.push(`[offline] ${tab.id} tab rendered almost no content while offline (${textLength} chars)`);
      }
    }

    // Every font actually used by the app (Newsreader via .font-serif-title,
    // Plus Jakarta Sans everywhere else) must reach 'loaded' — not
    // 'unloaded' (never actually rendered) or 'error' (fetch failed) — this
    // is the real signal that cache-first assets serve correctly while
    // fully offline (design-refresh-v3 Faz 5 F1). Visiting all 4 tabs above
    // is what actually triggers Newsreader's first render, since
    // font-display: swap fonts only fetch lazily on first use.
    await page.evaluate(() => document.fonts.ready);
    const fontStatuses = await page.evaluate(() =>
      [...document.fonts].map((f) => ({ family: f.family, status: f.status }))
    );
    // Noto Naskh Arabic (Faz 25 Commit 2, DuaCard) is excluded here: its
    // unicode-range only covers Arabic-script codepoints, and the dua
    // content is still a bracketed Latin-text placeholder (dualar.ts) — a
    // browser correctly never fetches a font whose range no on-screen
    // character needs, so 'unloaded' is expected, not a cache/offline
    // failure. Re-include once real Arabic dua text lands.
    const badFonts = fontStatuses.filter((f) => f.status !== 'loaded' && f.family !== 'Noto Naskh Arabic');
    if (badFonts.length > 0) {
      violations.push(`[offline] font(s) not loaded while offline: ${JSON.stringify(badFonts)}`);
    }

    if (failedRequests.length > 0) {
      violations.push(
        `[offline] ${failedRequests.length} non-API request(s) failed while offline: ${failedRequests.join(', ')}`
      );
    }

    console.log('  All 4 tabs render offline, countdown active, all fonts loaded, zero non-API request failures.');
  } catch (err) {
    violations.push(`[offline] check threw: ${err.message}`);
  } finally {
    await context.setOffline(false);
    await context.close();
  }
}

/**
 * Serverless deployment scenario (design-refresh-v3 Faz 9 Final) — the same
 * dist/ served with no /api/* or /health at all (a genuine 404, matching
 * netlify.toml), verifying the app correctly manages the server's absence
 * rather than just assuming a server always exists somewhere.
 */
async function checkServerlessScenario(browser) {
  console.log('\n=== Serverless scenario (no server, 404 on /health and /api/*) ===');
  const server = createStaticServer(path.resolve('dist'));
  await listenOnce(server, STATIC_PORT);

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    locale: 'tr-TR',
    timezoneId: 'Europe/Istanbul',
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(err.message));

  const dailyVerseRequests = [];
  page.on('request', (req) => {
    if (req.url().includes('/api/daily-verse')) dailyVerseRequests.push(req.url());
  });

  try {
    await page.goto(STATIC_BASE_URL, { waitUntil: 'load', timeout: 20000 });
    await page.waitForTimeout(600);

    // apiAvailable false olarak çözülüyor + Ayarlar'da bildirim bölümü hiç
    // render edilmiyor.
    await page.getByRole('tab', { name: 'Ayarlar' }).click();
    await page.waitForTimeout(600); // useApiAvailable'ın /health isteği + 404 çözümü için

    const notificationSectionVisible = await page.evaluate(() =>
      [...document.querySelectorAll('div')].some((el) => el.textContent.trim() === 'Bildirimleri Etkinleştir')
    );
    if (notificationSectionVisible) {
      violations.push('[serverless] apiAvailable false olmasına rağmen bildirim bölümü hâlâ görünüyor');
    }
    const unavailableNoteVisible = await page.evaluate(() =>
      [...document.querySelectorAll('p')].some((el) =>
        el.textContent.includes('Vakit bildirimleri bu sürümde kullanılamıyor')
      )
    );
    if (!unavailableNoteVisible) {
      violations.push('[serverless] "Vakit bildirimleri bu sürümde kullanılamıyor" notu görünmüyor');
    }
    // Sunucudan bağımsız çalışan tek gerçek ses özelliği yine de görünmeli.
    const ezanToggleVisible = await page.evaluate(() =>
      [...document.querySelectorAll('div')].some((el) => el.textContent.trim() === 'Uygulama Açıkken Ezan Sesi Çal')
    );
    if (!ezanToggleVisible) {
      violations.push('[serverless] sunucudan bağımsız "Uygulama Açıkken Ezan Sesi Çal" ayarı kayboldu');
    }

    // Konum sheet'inde "İnternette Ara" butonu yok, yerel arama çalışıyor.
    await page.getByRole('button', { name: 'Konumu Değiştir' }).click();
    await page.waitForTimeout(500);
    const searchInput = page.getByPlaceholder('Şehir veya ilçe ara (örn: Üsküdar, Ankara, Mekke...)');
    await searchInput.fill('Gebze');
    await page.waitForTimeout(400);

    const gebzeResultVisible = await page.evaluate(() =>
      [...document.querySelectorAll('button')].some((el) => el.textContent.includes('Gebze'))
    );
    if (!gebzeResultVisible) {
      violations.push('[serverless] yerel arama "Gebze" için sonuç döndürmedi');
    }
    const internetSearchButtonVisible = await page.evaluate(() =>
      [...document.querySelectorAll('button')].some(
        (el) => el.textContent.includes('İnternette Ara') || el.textContent.includes('İnternette ara')
      )
    );
    if (internetSearchButtonVisible) {
      violations.push('[serverless] apiAvailable false olmasına rağmen "İnternette Ara" butonu görünüyor');
    }
    await page.keyboard.press('Escape');
    await waitForDialogClosed(page);

    // Gizlilik sheet'i açılıyor, taşma ve kontrast ihlali yok.
    await page.getByRole('tab', { name: 'Ayarlar' }).click();
    await page.waitForTimeout(400);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(600);
    await page.getByRole('button', { name: 'Gizlilik politikasının tamamı →' }).click();
    await page.waitForTimeout(500);
    await checkScreen(page, { name: 'serverless' }, 'privacy-sheet');
    await page.keyboard.press('Escape');
    await waitForDialogClosed(page);

    if (dailyVerseRequests.length > 0) {
      violations.push(
        `[serverless] /api/daily-verse'e ${dailyVerseRequests.length} istek gitti — apiAvailable false iken hiç gitmemeli`
      );
    }
    // Bu senaryoda /health ve /api/* kasıtlı olarak 404 döner (useApiAvailable'ın
    // probe'u dahil); Chrome bu tür non-2xx fetch yanıtları için "Failed to load
    // resource...404" satırını JS'in hatayı yakalayıp yakalamadığından bağımsız
    // olarak konsola düşürür. Bu, senaryonun kasıtlı ürettiği zararsız bir
    // tanı çıktısıdır — gerçek hatalar (örn. React uyarıları, JS istisnaları) ayrı kalır.
    const EXPECTED_NETWORK_ERROR_PATTERN = /^Failed to load resource: the server responded with a status of 404/;
    const unexpectedConsoleErrors = consoleErrors.filter((text) => !EXPECTED_NETWORK_ERROR_PATTERN.test(text));
    if (unexpectedConsoleErrors.length > 0) {
      violations.push(`[serverless] konsola ${unexpectedConsoleErrors.length} beklenmeyen hata düştü: ${unexpectedConsoleErrors.join(' | ')}`);
    }

    console.log('  apiAvailable=false doğru yönetiliyor: bildirim bölümü gizli, yerel arama çalışıyor, günün ayeti isteği yok.');
  } catch (err) {
    violations.push(`[serverless] check threw: ${err.message}`);
  } finally {
    await context.close();
    await closeServer(server);
  }
}

/**
 * Regression test for design-refresh-v3 Faz 9 M1: a host whose SPA fallback
 * answers *every* path with 200 + index.html, including /health — i.e. no
 * server-side defense at all (netlify.toml's 404 rules absent/misconfigured).
 * useApiAvailable's body-content check must still resolve false purely from
 * the client side.
 */
async function checkSpaFallbackRegression(browser) {
  console.log('\n=== SPA-fallback-mimicking regression scenario (/health -> 200 + HTML) ===');
  const server = createStaticServer(path.resolve('dist'), { mimicBrokenSpaFallback: true });
  await listenOnce(server, STATIC_PORT);

  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);

  try {
    await page.goto(STATIC_BASE_URL, { waitUntil: 'load', timeout: 20000 });
    await page.waitForTimeout(600);

    const healthRes = await page.evaluate(async () => {
      const res = await fetch('/health');
      return { status: res.status, contentType: res.headers.get('content-type') };
    });
    if (healthRes.status !== 200 || !healthRes.contentType?.includes('text/html')) {
      violations.push(
        `[spa-fallback-regression] test senaryosu beklendiği gibi kurulmadı: /health -> ${healthRes.status} ${healthRes.contentType}`
      );
    }

    await page.getByRole('tab', { name: 'Ayarlar' }).click();
    await page.waitForTimeout(600);

    const notificationSectionVisible = await page.evaluate(() =>
      [...document.querySelectorAll('div')].some((el) => el.textContent.trim() === 'Bildirimleri Etkinleştir')
    );
    if (notificationSectionVisible) {
      violations.push(
        '[spa-fallback-regression] /health 200+HTML döndürüyor ama bildirim bölümü hâlâ görünüyor — useApiAvailable body kontrolü çalışmıyor'
      );
    } else {
      console.log('  /health 200 + HTML döndürse bile apiAvailable doğru şekilde false çözüyor.');
    }
  } catch (err) {
    violations.push(`[spa-fallback-regression] check threw: ${err.message}`);
  } finally {
    await context.close();
    await closeServer(server);
  }
}

/**
 * Regression test for the "can't type in the location search box" report —
 * a BottomSheet's focus-trap effect depended on `onClose`, an inline arrow
 * function recreated on every App re-render (App re-renders every second
 * from its countdown timer), so the effect tore down and re-ran every
 * second, including its `.focus()` call on the sheet's first focusable
 * element — silently stealing focus away from the search input the user
 * had just typed into. Bisected to 4c6a411 ("modals become bottom sheets"),
 * fixed in BottomSheet.tsx via a ref for the latest onClose (design-refresh-v3
 * Faz 11). Deliberately does NOT use `page.clock.install` — the bug only
 * manifests with the real setInterval driving App's `now` state, so this
 * check needs real wall-clock time to elapse, not a frozen/virtual clock.
 */
async function checkLocationSearchFocusRegression(browser) {
  console.log('\n=== Location search input focus regression (real timers) ===');
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'tr-TR' });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);

  try {
    await page.goto(BASE_URL, { waitUntil: 'load', timeout: 20000 });
    await page.waitForTimeout(600);

    await page.getByRole('button', { name: 'Konumu Değiştir' }).click();
    await page.waitForTimeout(500);

    const placeholder = 'Şehir veya ilçe ara (örn: Üsküdar, Ankara, Mekke...)';
    const input = page.getByPlaceholder(placeholder);
    await input.click();
    await input.type('Ank', { delay: 80 });

    const valueAfterType = await input.inputValue();
    const focusedAfterType = await page.evaluate(
      (ph) => document.activeElement?.getAttribute('placeholder') === ph,
      placeholder
    );
    const dialogTextAfterType = await page.evaluate(
      () => document.querySelector('[role="dialog"]')?.innerText ?? ''
    );

    // The 2s wait is the actual regression signal: does focus silently move
    // away on its own, with zero further user interaction?
    await page.waitForTimeout(2000);
    const focusedAfter2s = await page.evaluate(
      (ph) => document.activeElement?.getAttribute('placeholder') === ph,
      placeholder
    );
    const valueAfter2s = await input.inputValue();

    if (valueAfterType !== 'Ank') {
      violations.push(`[location-focus] typing "Ank" produced value ${JSON.stringify(valueAfterType)}`);
    }
    if (!focusedAfterType) {
      violations.push('[location-focus] input lost focus immediately after typing (before any wait)');
    }
    if (!dialogTextAfterType.includes('Çankaya')) {
      violations.push('[location-focus] local search for "Ank" did not surface "Çankaya"');
    }
    if (dialogTextAfterType.includes('Üsküdar')) {
      violations.push('[location-focus] local search for "Ank" incorrectly still shows "Üsküdar"');
    }
    if (!focusedAfter2s) {
      violations.push(
        '[location-focus] input silently lost focus 2s after typing with no further interaction — the exact reported regression'
      );
    }
    if (valueAfter2s !== 'Ank') {
      violations.push(`[location-focus] value changed on its own after 2s idle: ${JSON.stringify(valueAfter2s)}`);
    }

    if (focusedAfterType && focusedAfter2s && valueAfter2s === 'Ank') {
      console.log('  Arama kutusu odağı ve değeri 2 saniyelik bekleme boyunca korunuyor.');
    }
  } catch (err) {
    violations.push(`[location-focus] check threw: ${err.message}`);
  } finally {
    await context.close();
  }
}

/**
 * Broad interaction sweep (design-refresh-v3 Faz 11 item 4) — the location
 * search box bug was one instance of a class of bug (BottomSheet's shared
 * focus-trap effect); this exercises every other BottomSheet consumer,
 * every Ayarlar segmented/picker control (value change AND persistence
 * across reload), the Zikirmatik counter, Navbar tab switching, and
 * location selection actually changing the displayed location — so the
 * same class of bug elsewhere, or a regression in any of these, fails loud
 * instead of silently. Real timers (no page.clock.install), matching the
 * focus regression check above.
 */
async function checkInteractionSweep(browser) {
  console.log('\n=== Interaction sweep (modals, settings persistence, zikirmatik, navbar) ===');
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'tr-TR' });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(err.message));

  try {
    await page.goto(BASE_URL, { waitUntil: 'load', timeout: 20000 });
    await page.waitForTimeout(600);

    // --- Navbar: all 4 tabs switch ---
    for (const tab of TABS) {
      await page.getByRole('tab', { name: tab.label }).click();
      await page.waitForTimeout(300);
      const selected = await page.getByRole('tab', { name: tab.label }).getAttribute('aria-selected');
      if (selected !== 'true') {
        violations.push(`[sweep] Navbar "${tab.label}" tıklandı ama aria-selected="true" olmadı`);
      }
    }

    // --- Location modal: select a city, verify it propagates + modal closes ---
    const locationLabelBefore = await page.evaluate(
      () => document.querySelector('[aria-label="Konumu Değiştir"]')?.textContent ?? ''
    );
    await page.getByRole('button', { name: 'Konumu Değiştir' }).click();
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: /Çankaya/ }).click();
    await page.waitForTimeout(500);
    const dialogStillOpenAfterSelect = await page.evaluate(() => !!document.querySelector('[role="dialog"]'));
    if (dialogStillOpenAfterSelect) {
      violations.push('[sweep] konum seçildikten sonra sheet kapanmadı');
    }
    const locationLabelAfter = await page.evaluate(
      () => document.querySelector('[aria-label="Konumu Değiştir"]')?.textContent ?? ''
    );
    if (!locationLabelAfter.includes('Çankaya') || locationLabelAfter === locationLabelBefore) {
      violations.push(
        `[sweep] konum seçimi başlıkta yansımadı: önce="${locationLabelBefore}" sonra="${locationLabelAfter}"`
      );
    }

    // Polls instead of a fixed sleep — BottomSheet's exit spring
    // (damping:32, stiffness:320) keeps the dialog mounted for the
    // duration of its transition, and how long that takes in wall-clock
    // time varies with how loaded the machine is (this check runs after
    // several heavy screenshot/pixel-sampling passes earlier in the
    // suite). A fixed 300ms sleep here produced a false "didn't close"
    // under that load even though the close genuinely happened, just a
    // bit later.
    // --- LocationModal: Escape and backdrop close ---
    await page.getByRole('button', { name: 'Konumu Değiştir' }).click();
    await page.waitForTimeout(400);
    await page.keyboard.press('Escape');
    if (!(await waitForDialogClosed(page))) {
      violations.push('[sweep] LocationModal Escape ile kapanmadı');
    }
    await page.getByRole('button', { name: 'Konumu Değiştir' }).click();
    await page.waitForTimeout(400);
    await page.mouse.click(10, 10); // backdrop corner, outside the sheet
    if (!(await waitForDialogClosed(page))) {
      violations.push('[sweep] LocationModal backdrop tıklamasıyla kapanmadı');
    }

    // --- Qibla modal: open, Escape closes, reopen, backdrop closes ---
    await page.getByRole('button', { name: 'Kıble Pusulası' }).click();
    await page.waitForTimeout(400);
    if (!(await page.evaluate(() => !!document.querySelector('[role="dialog"]')))) {
      violations.push('[sweep] Kıble Pusulası sheet\'i açılmadı');
    }
    await page.keyboard.press('Escape');
    if (!(await waitForDialogClosed(page))) {
      violations.push('[sweep] Kıble Pusulası Escape ile kapanmadı');
    }
    await page.getByRole('button', { name: 'Kıble Pusulası' }).click();
    await page.waitForTimeout(400);
    await page.mouse.click(10, 10);
    if (!(await waitForDialogClosed(page))) {
      violations.push('[sweep] Kıble Pusulası backdrop tıklamasıyla kapanmadı');
    }

    // --- Zikirmatik: increment, then reset (cancel then confirm) ---
    await page.getByRole('button', { name: 'Zikirmatik' }).click();
    await page.waitForTimeout(400);
    const counterText = () => page.getByRole('button', { name: 'Zikir say' }).locator('span').first().innerText();
    const countBefore = parseInt(await counterText(), 10);
    await page.getByRole('button', { name: 'Zikir say' }).click();
    await page.getByRole('button', { name: 'Zikir say' }).click();
    await page.waitForTimeout(200);
    const countAfterTaps = parseInt(await counterText(), 10);
    if (countAfterTaps !== countBefore + 2) {
      violations.push(
        `[sweep] Zikirmatik sayacı 2 dokunuştan sonra beklenmedik: önce=${countBefore} sonra=${countAfterTaps}`
      );
    }
    await page.getByRole('button', { name: 'Sıfırla' }).click();
    await page.waitForTimeout(200);
    await page.getByRole('button', { name: 'Vazgeç' }).click();
    await page.waitForTimeout(200);
    const countAfterCancel = parseInt(await counterText(), 10);
    if (countAfterCancel !== countAfterTaps) {
      violations.push('[sweep] "Vazgeç" sıfırlamayı iptal etmedi, sayaç değişti');
    }
    await page.getByRole('button', { name: 'Sıfırla' }).click();
    await page.waitForTimeout(200);
    await page.getByRole('button', { name: 'Emin misiniz?' }).click();
    await page.waitForTimeout(200);
    const countAfterConfirm = parseInt(await counterText(), 10);
    if (countAfterConfirm !== 0) {
      violations.push(`[sweep] Zikirmatik sıfırlama onaylandıktan sonra sayaç 0 değil: ${countAfterConfirm}`);
    }
    await page.keyboard.press('Escape');
    await waitForDialogClosed(page);

    // --- Ayarlar: every toggle switch's thumb sits in the correct HALF of
    // its track, not just "somewhere inside its bounds". A geometric
    // in-bounds-only check previously passed a real bug: the thumb's
    // untranslated base position resolved to the track's right edge (an
    // absolute+blockified <span> with no explicit `left`, not a deliberate
    // justify-end/ml-auto), so translate-x was added on top of an
    // already-right-leaning base — closed state happened to land in-bounds
    // by coincidence (flush against the right edge instead of the left),
    // open state translated straight past the track's right edge entirely.
    // Fixed by anchoring the thumb's base position with an explicit
    // `left-0` (design-refresh-v3 Faz 12) so translate is the only thing
    // moving it — this check exists so a future regression that removes
    // that anchor fails loud instead of merely "still technically inside".
    await page.getByRole('tab', { name: 'Ayarlar' }).click();
    await page.waitForTimeout(500);
    const switchHandles = await page.locator('[role="switch"]').all();
    for (const [i, handle] of switchHandles.entries()) {
      const label = (await handle.getAttribute('aria-label')) ?? `switch #${i}`;
      const readGeometry = async () => {
        return handle.evaluate((btn) => {
          const track = btn.querySelector('span');
          const thumb = track.querySelector('span');
          const t = track.getBoundingClientRect();
          const h = thumb.getBoundingClientRect();
          return {
            checked: btn.getAttribute('aria-checked') === 'true',
            trackLeft: t.left,
            trackMid: t.left + t.width / 2,
            trackRight: t.right,
            thumbLeft: h.left,
            thumbRight: h.right,
          };
        });
      };
      const before = await readGeometry();
      const assertHalf = (g, when) => {
        if (g.thumbLeft < g.trackLeft || g.thumbRight > g.trackRight) {
          violations.push(
            `[sweep] "${label}" topuzu ${when} ray dışına taşıyor: thumb=[${g.thumbLeft.toFixed(1)},${g.thumbRight.toFixed(1)}] track=[${g.trackLeft.toFixed(1)},${g.trackRight.toFixed(1)}]`
          );
          return;
        }
        if (g.checked) {
          if (g.thumbLeft < g.trackMid) {
            violations.push(`[sweep] "${label}" AÇIK ama topuz rayın sol yarısında (thumbLeft=${g.thumbLeft.toFixed(1)} < mid=${g.trackMid.toFixed(1)})`);
          }
        } else if (g.thumbRight > g.trackMid) {
          violations.push(`[sweep] "${label}" KAPALI ama topuz rayın sağ yarısında (thumbRight=${g.thumbRight.toFixed(1)} > mid=${g.trackMid.toFixed(1)})`);
        }
      };
      assertHalf(before, 'başlangıçta');
      await handle.click();
      await page.waitForTimeout(300);
      const afterToggle = await readGeometry();
      if (afterToggle.checked === before.checked) {
        violations.push(`[sweep] "${label}" tıklandı ama aria-checked değişmedi`);
      }
      assertHalf(afterToggle, 'değiştirildikten sonra');
      // Restore original state so this doesn't leave settings mutated.
      await handle.click();
      await page.waitForTimeout(300);
      const restored = await readGeometry();
      assertHalf(restored, 'geri alındıktan sonra');
    }

    // --- Ayarlar: theme-mode segmented control changes value + persists ---
    await page.getByRole('button', { name: 'Koyu' }).click();
    await page.waitForTimeout(400);
    const isDarkAfterClick = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    if (!isDarkAfterClick) {
      violations.push('[sweep] "Koyu" segmented control tıklandı ama .dark class eklenmedi');
    }
    await page.reload({ waitUntil: 'load', timeout: 20000 });
    await page.waitForTimeout(600);
    const isDarkAfterReload = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    if (!isDarkAfterReload) {
      violations.push('[sweep] Tema tercihi (Koyu) sayfa yenilendikten sonra kalıcı değil');
    }
    // Restore to Otomatik so this run doesn't leave dark mode on for anything downstream.
    await page.getByRole('tab', { name: 'Ayarlar' }).click();
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Otomatik' }).click();
    await page.waitForTimeout(300);

    // --- Ayarlar: hesaplama yöntemi artık sabit (Diyanet), seçim arayüzü
    // yok (design-refresh-v3 Faz 19) — bilgi satırının göründüğünü ve
    // tıklanabilir/etkileşimli bir seçim kontrolü OLMADIĞINI doğrular, tam
    // tersi kalıcılık testinin yerini alır.
    await page.getByRole('tab', { name: 'Ayarlar' }).click();
    await page.waitForTimeout(500);
    const methodInfoVisible = await page.evaluate(() =>
      [...document.querySelectorAll('div')].some((el) => el.textContent.trim() === 'Türkiye Diyanet İşleri Başkanlığı yöntemi')
    );
    if (!methodInfoVisible) {
      violations.push('[sweep] "Türkiye Diyanet İşleri Başkanlığı yöntemi" bilgi satırı görünmüyor');
    }
    const methodPickerStillExists = await page.evaluate(() =>
      [...document.querySelectorAll('button')].some((el) => /Müslüman Dünya Ligi|ISNA|Ümmü.?l-Kurâ|Karaçi/.test(el.textContent ?? ''))
    );
    if (methodPickerStillExists) {
      violations.push('[sweep] kaldırılmış hesaplama yöntemi seçim arayüzü hâlâ mevcut');
    }

    if (consoleErrors.length > 0) {
      violations.push(`[sweep] konsola ${consoleErrors.length} hata düştü: ${consoleErrors.join(' | ')}`);
    } else {
      console.log('  Navbar, konum seçimi, Kıble/Zikirmatik sheet\'leri, tema kalıcılığı ve hesaplama yöntemi bilgi satırı doğru; konsol temiz.');
    }
  } catch (err) {
    violations.push(`[sweep] check threw: ${err.message}`);
  } finally {
    await context.close();
  }
}

/**
 * GPS-derived locations must not claim a district name as fact — the
 * coordinate is real but the name attached to it is a nearest-known-center
 * guess (design-refresh-v3 Faz 14, real-device report: GPS in Darıca
 * matched "Çayırova", an adjacent district with a very close center
 * coordinate). Mocks geolocation to Darıca's own stored coordinate (so the
 * nearest-match is deterministic — this isn't testing match *accuracy*,
 * it's testing that the header is honest about what it is regardless of
 * whether the match happens to be right), and separately confirms a
 * manually-picked location still gets the district name as its title —
 * without that control case, this check could pass by coincidence if the
 * conditional were inverted or dropped entirely.
 */
async function checkGpsLocationLabelHonesty(browser) {
  console.log('\n=== GPS location label honesty (no district-name claim) ===');
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: 'tr-TR',
    geolocation: { latitude: 40.76, longitude: 29.38 },
    permissions: ['geolocation'],
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const violationsBefore = violations.length;

  try {
    await page.goto(BASE_URL, { waitUntil: 'load', timeout: 20000 });
    await page.waitForTimeout(600);

    await page.getByRole('button', { name: 'Konumu Değiştir' }).click();
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: 'Mevcut Konumumu Otomatik Kullan (GPS)' }).click();
    await page.waitForTimeout(1200);

    const headerText = await page.evaluate(
      () => document.querySelector('[aria-label="Konumu Değiştir"]')?.textContent ?? ''
    );
    if (!headerText.includes('Mevcut Konum')) {
      violations.push(`[gps-label] GPS sonrası başlık "Mevcut Konum" demiyor: "${headerText}"`);
    }
    if (headerText.includes('Darıca') && !headerText.includes('en yakın merkez')) {
      violations.push(
        `[gps-label] GPS sonrası başlık ilçe adını "en yakın merkez" bağlamı olmadan içeriyor: "${headerText}"`
      );
    }
    if (!/\d\d?\.\d\d,\s*\d\d?\.\d\d/.test(headerText)) {
      violations.push(`[gps-label] GPS sonrası başlıkta koordinat (2 ondalık) görünmüyor: "${headerText}"`);
    }

    // Control: a manually-picked location must still show the district
    // name as its title — proves this check actually distinguishes the
    // two paths instead of just matching new copy anywhere.
    await page.getByRole('button', { name: 'Konumu Değiştir' }).click();
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: /Çankaya/ }).click();
    await page.waitForTimeout(400);
    const headerTextAfterManualPick = await page.evaluate(
      () => document.querySelector('[aria-label="Konumu Değiştir"]')?.textContent ?? ''
    );
    if (!headerTextAfterManualPick.includes('Çankaya') || headerTextAfterManualPick.includes('Mevcut Konum')) {
      violations.push(
        `[gps-label] elle seçilen konum başlıkta ilçe adı olarak görünmüyor: "${headerTextAfterManualPick}"`
      );
    }

    if (violations.length === violationsBefore) {
      console.log('  GPS başlığı ilçe adı iddia etmiyor; elle seçim hâlâ ilçe adını gösteriyor.');
    }
  } catch (err) {
    violations.push(`[gps-label] check threw: ${err.message}`);
  } finally {
    await context.close();
  }
}

/**
 * Ramazan modu (design-refresh-v3 Faz 19 Ekleme 6) — RamadanModeCard only
 * renders when getRamadanInfo() finds `now` inside a verified Ramadan
 * range (religiousDays.ts), so the app's two fixed SCENARIOS (2026-08-01)
 * never exercise it — without a dedicated check here, this whole screen
 * would ship with zero overflow/contrast/touch-target coverage. Also
 * verifies the reverse: the card must be completely absent outside
 * Ramadan (the explicit "hidden outside Ramadan" requirement) — checked
 * against the same 2026-08-01 date the main SCENARIOS already use, so a
 * regression here would already be a second, independent signal beyond
 * this function alone.
 */
async function checkRamadanMode(browser) {
  console.log('\n=== Ramazan modu (yalnızca Ramazan\'da görünür) ===');

  // Inside Ramadan 2026 (2026-02-19 .. 2026-03-19), a daytime hour so the
  // card is in its "İftara kalan" branch — the more visually complex of
  // its two live states (both header rows + countdown + İmsak/İftar row).
  const ramadanContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    locale: 'tr-TR',
    timezoneId: 'Europe/Istanbul',
  });
  const ramadanPage = await ramadanContext.newPage();
  ramadanPage.setDefaultTimeout(10000);
  try {
    await ramadanPage.clock.install({ time: new Date('2026-03-01T13:00:00').getTime() });
    await ramadanPage.goto(BASE_URL, { waitUntil: 'load', timeout: 20000 });
    await ramadanPage.waitForTimeout(600);

    const cardVisible = await ramadanPage.evaluate(() =>
      [...document.querySelectorAll('div')].some((el) => el.textContent?.trim() === 'İftara')
    );
    if (!cardVisible) {
      violations.push('[ramazan] Ramazan içinde RamadanModeCard görünmüyor ("İftara" etiketi bulunamadı)');
    } else {
      await checkScreen(ramadanPage, { name: 'ramazan' }, 'focus-ramazan');
      console.log('  Ramazan içinde kart görünüyor; ekran kontrolleri (taşma/kontrast/tap hedefi) geçti.');
    }
  } catch (err) {
    violations.push(`[ramazan] active-state check threw: ${err.message}`);
  } finally {
    await ramadanContext.close();
  }

  // Outside Ramadan (same date the main SCENARIOS already use): the card
  // must render nothing at all, not just be visually empty.
  const nonRamadanContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: 'tr-TR',
    timezoneId: 'Europe/Istanbul',
  });
  const nonRamadanPage = await nonRamadanContext.newPage();
  nonRamadanPage.setDefaultTimeout(10000);
  try {
    await nonRamadanPage.clock.install({ time: new Date('2026-08-01T13:30:00').getTime() });
    await nonRamadanPage.goto(BASE_URL, { waitUntil: 'load', timeout: 20000 });
    await nonRamadanPage.waitForTimeout(600);

    const cardVisibleOutsideRamadan = await nonRamadanPage.evaluate(() =>
      [...document.querySelectorAll('div')].some((el) => el.textContent?.trim() === 'İftara')
    );
    if (cardVisibleOutsideRamadan) {
      violations.push('[ramazan] RamadanModeCard Ramazan dışında da görünüyor — tamamen gizli olmalı');
    } else {
      console.log('  Ramazan dışında kart tamamen gizli.');
    }
  } catch (err) {
    violations.push(`[ramazan] hidden-state check threw: ${err.message}`);
  } finally {
    await nonRamadanContext.close();
  }
}

/**
 * Bottom Navbar legibility (design-refresh-v3 Faz 18 F7) — .glass-panel's
 * background must obscure content scrolled behind the fixed Navbar, not
 * just look translucent in isolation. Real-device report: "22:04 Bildirim"
 * (a DailyFlowList row) was legibly ghosted through the "AYARLAR" tab.
 * Reproduced and calibrated the fix with this exact pixel-sampling
 * approach: scrolls the Vakitler tab's <main> (the app's only scroll
 * container since design-refresh-v3 Faz 24 Commit 1 — html/body are
 * overflow:hidden, so window/document no longer scroll) to a position
 * partway through its range (0.3 x
 * max — not the natural rest/max scroll, which the app's own
 * .app-shell-padding correctly clears; the legibility risk is content
 * passing behind the Navbar mid-scroll, before it settles), then samples
 * pixels ONLY in genuinely "glass-only" spots: inside the Navbar's own
 * hit-box padding (real risk area — a button's box is much bigger than
 * its icon+label) but outside every button's icon/label/active-pill
 * highlight and the Navbar's own top border line (all legitimate Navbar
 * chrome, sampling there would false-positive on the Navbar's own
 * rendering, not bleed-through). A real letter/digit edge survives a 16px
 * blur as a local jump between pixels a few px apart; a properly-obscured
 * background does not. Threshold calibrated against real measurements:
 * 65% opacity (the original bug) peaked at 79/255, 90% at 22, the shipped
 * 98.5% at 4 (light and dark both) — 15 sits with margin above the fix's
 * real reading and well below every reading that was actually visible.
 */
const NAVBAR_EDGE_THRESHOLD = 15;

async function checkNavbarLegibility(browser) {
  console.log('\n=== Alt menü (Navbar) okunabilirlik testi ===');
  for (const scenario of SCENARIOS) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      locale: 'tr-TR',
      timezoneId: 'Europe/Istanbul',
    });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    try {
      const fixedTime = new Date(scenario.time).getTime();
      await page.clock.install({ time: fixedTime });
      await page.goto(BASE_URL, { waitUntil: 'load', timeout: 20000 });
      await page.waitForTimeout(600);

      // Vakitler (DailyFlowList) has the longest, densest text list — the
      // real report came from exactly this screen.
      await page.getByRole('tab', { name: 'Vakitler' }).click();
      await page.waitForTimeout(500);

      // design-refresh-v3 Faz 24 Commit 1 — <main> is now the app's real
      // (and only) scroll container; document.documentElement no longer
      // scrolls (html/body are overflow:hidden, capped to viewport height).
      const maxScroll = await page.evaluate(() => {
        const main = document.querySelector('main');
        return main.scrollHeight - main.clientHeight;
      });
      await page.evaluate((y) => {
        const main = document.querySelector('main');
        main.scrollTop = Math.round(y);
      }, maxScroll * 0.3);
      await page.waitForTimeout(300);

      const dpr = await page.evaluate(() => window.devicePixelRatio);
      const navRect = await page.evaluate(() => {
        const nav = document.querySelector('[role="tablist"]');
        const r = nav.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      });

      const points = await page.evaluate(({ x, y, width, height }) => {
        // svg/span/path: each tab's own icon+label. The active tab's pill
        // highlight (motion.div, bg-accent/10, `inset-0` filling that
        // button's own box) is ALSO excluded here — it's a deliberate,
        // by-design color difference marking the selected tab, not
        // bleed-through, and its rounded-corner antialiasing would
        // otherwise false-positive this check.
        const skipEls = [
          ...document.querySelectorAll('[role="tablist"] svg, [role="tablist"] span, [role="tablist"] path, [role="tablist"] .bg-accent\\/10'),
        ];
        const skipBoxes = skipEls.map((el) => {
          const r = el.getBoundingClientRect();
          const margin = 4;
          return { left: r.left - margin, right: r.right + margin, top: r.top - margin, bottom: r.bottom + margin };
        });
        const pts = [];
        const cols = 40, rows = 12;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const px = x + (width * (c + 0.5)) / cols;
            const py = y + (height * (r + 0.5)) / rows;
            if (py < y + 8) continue; // clear the Navbar's own top border line
            if (px < 6 || px > width - 6) continue; // clear screen edges
            const skipped = skipBoxes.some((b) => px >= b.left && px <= b.right && py >= b.top && py <= b.bottom);
            if (!skipped) pts.push({ x: px, y: py });
          }
        }
        return pts;
      }, navRect);

      if (points.length < 10) {
        violations.push(
          `[${scenario.name}/navbar-legibility] yeterli "boş cam" pikseli bulunamadı (${points.length}) — test güvenilir değil`
        );
        continue;
      }

      const shot = await page.screenshot();
      const { data, info } = await sharp(shot).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const samplePixel = (px, py) => {
        const x = Math.min(Math.max(Math.round(px), 0), info.width - 1);
        const y = Math.min(Math.max(Math.round(py), 0), info.height - 1);
        const i = (y * info.width + x) * info.channels;
        return [data[i], data[i + 1], data[i + 2]];
      };

      let maxDelta = 0;
      let maxPoint = null;
      for (const pt of points) {
        const base = samplePixel(pt.x * dpr, pt.y * dpr);
        for (const [dx, dy] of [[3, 0], [-3, 0], [0, 3], [0, -3]]) {
          const neighbor = samplePixel((pt.x + dx) * dpr, (pt.y + dy) * dpr);
          const delta = Math.max(
            Math.abs(base[0] - neighbor[0]),
            Math.abs(base[1] - neighbor[1]),
            Math.abs(base[2] - neighbor[2])
          );
          if (delta > maxDelta) {
            maxDelta = delta;
            maxPoint = pt;
          }
        }
      }

      if (maxDelta > NAVBAR_EDGE_THRESHOLD) {
        violations.push(
          `[${scenario.name}/navbar-legibility] alt menü arkasından metin sızıyor: piksel farkı ${maxDelta} ` +
            `(eşik ${NAVBAR_EDGE_THRESHOLD}) @ (${maxPoint.x.toFixed(0)},${maxPoint.y.toFixed(0)})`
        );
      } else {
        console.log(`  [${scenario.name}] alt menü arkasındaki metin görünmüyor (maks piksel farkı ${maxDelta} <= ${NAVBAR_EDGE_THRESHOLD}).`);
      }
    } catch (err) {
      violations.push(`[${scenario.name}/navbar-legibility] check threw: ${err.message}`);
    } finally {
      await context.close();
    }
  }
}

/**
 * Tab-transition layout stability (design-refresh-v3 Faz 18 F8) — root
 * cause was App.tsx's tab-panel motion.div mounting with `y: 8`: a CSS
 * transform on a descendant still counts toward its nearest
 * non-`overflow:visible` ancestor's (here, `<main>`, which has
 * `overflow-y-auto`) scrollable-overflow region, regardless of nesting
 * depth — moving the transform to an inner wrapper would NOT have fixed
 * this (still a descendant of `<main>`), so the fix removes the y
 * transform entirely (opacity-only fade) rather than relocating it.
 * Verified directly: with `y: 8` still in place, sampling every 15ms
 * through a real transition showed `main.scrollHeight` briefly read 690
 * against a `main.clientHeight` of 682 — an 8px phantom overflow, exactly
 * the transform amount, present for roughly one transition frame. With
 * the fix, scrollHeight tracks clientHeight exactly at every sampled
 * instant. `[scrollbar-gutter:stable]` on `<main>` is kept as the
 * general-purpose defense the task asked for (confirmed as the correct
 * target: this exact transient desync happens on `<main>` itself, not
 * the document — a SEPARATE, expected, non-bug behavior also exists
 * where switching between two tabs of genuinely different total content
 * height changes whether the whole page scrolls at all, which is
 * unrelated to this animation and out of scope here).
 */
/**
 * design-refresh-v3 Faz 24 Commit 1 — covers all 12 ordered tab pairs (every
 * tab to every other tab, both directions), not just the cyclic
 * focus->flow->spiritual->settings->focus order the previous version
 * sampled. The user-reported bug (scrollbar flicker on Maneviyat) and the
 * original [tab-transition] overshoot were both diagnosed as the SAME root
 * cause: <body> was an unconstrained second scroll container alongside
 * <main>'s own overflow-y-auto (its computed overflow-y read "auto" despite
 * only overflow-x ever being declared on it — App.tsx's root shell used
 * min-h-[100dvh], not a definite height, so <main>'s flex-1+overflow-y-auto
 * never actually got a bounded cross size to clip against). Fixed by
 * html/body { overflow: hidden } + the shell using h-[100dvh] (definite,
 * not minimum) — see src/index.css and App.tsx. Diagnostic instrumentation
 * (offsetHeight-per-child sampling, scroll-container enumeration,
 * enter/exit DOM-overlap check) confirmed exactly one [role=tabpanel] is
 * ever mounted at a time — mode="wait" was never the problem, so this fix
 * does NOT restructure the panels into an absolute-positioned overlay.
 */
/**
 * design-refresh-v3 Faz 24 Commit 4 — measures, not eyeballs, that the
 * location-search sheet's sticky block (GPS button + search input) does
 * not visibly move when 3 characters are typed (mounting a results list
 * below it) at 360x640 / 390x844 / 412x915, and that the same holds when
 * the viewport height is squeezed 640->320 to simulate reduced available
 * height. Note: Playwright's setViewportSize() shrinks window.innerHeight
 * and visualViewport.height together (no real on-screen-keyboard divergence
 * between them), so this validates the sticky/flex layout's robustness
 * under a shorter viewport, not BottomSheet.tsx's visualViewport-offset
 * compensation itself — headless Chromium has no real virtual keyboard to
 * exercise that path; it can only be confirmed on a real device.
 */
async function checkLocationSheetKeyboardStability(browser) {
  console.log('\n=== Şehir arama sheet\'i: klavye/yazma sırasında sabit blok kararlılığı ===');
  const viewports = [
    { width: 360, height: 640 },
    { width: 390, height: 844 },
    { width: 412, height: 915 },
  ];

  const measure = (page) =>
    page.evaluate(() => {
      const title = document.querySelector('[role="dialog"] h3');
      const input = document.querySelector('[role="dialog"] input[type="text"]');
      return {
        titleTop: title?.getBoundingClientRect().top ?? null,
        inputTop: input?.getBoundingClientRect().top ?? null,
      };
    });

  for (const viewport of viewports) {
    const label = `${viewport.width}x${viewport.height}`;
    const context = await browser.newContext({ viewport, locale: 'tr-TR', timezoneId: 'Europe/Istanbul' });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    try {
      await page.clock.install({ time: new Date(SCENARIOS[0].time).getTime() });
      await page.goto(BASE_URL, { waitUntil: 'load', timeout: 20000 });
      await page.waitForTimeout(600);
      await page.getByRole('button', { name: 'Konumu Değiştir' }).click();
      await page.waitForTimeout(500);

      const before = await measure(page);
      if (before.titleTop === null || before.inputTop === null) {
        violations.push(`[${label}] konum sheet'i açılmadı veya başlık/arama kutusu bulunamadı`);
        continue;
      }

      await page.locator('[role="dialog"] input[type="text"]').fill('Ank');
      await page.waitForTimeout(200);
      const afterTyping = await measure(page);
      if (Math.abs(afterTyping.titleTop - before.titleTop) > 1) {
        violations.push(
          `[${label}] yazma sırasında başlık kaydı: ${before.titleTop.toFixed(1)} -> ${afterTyping.titleTop.toFixed(1)}`
        );
      }
      if (Math.abs(afterTyping.inputTop - before.inputTop) > 1) {
        violations.push(
          `[${label}] yazma sırasında arama kutusu kaydı: ${before.inputTop.toFixed(1)} -> ${afterTyping.inputTop.toFixed(1)}`
        );
      }

      // Klavye simülasyonu: viewport yüksekliğini daralt, aynı ölçümü tekrarla.
      await page.setViewportSize({ width: viewport.width, height: 320 });
      await page.waitForTimeout(200);
      const beforeShrink = await measure(page);
      await page.locator('[role="dialog"] input[type="text"]').fill('Ankara');
      await page.waitForTimeout(200);
      const afterShrink = await measure(page);
      if (beforeShrink.titleTop !== null && afterShrink.titleTop !== null) {
        if (Math.abs(afterShrink.titleTop - beforeShrink.titleTop) > 1) {
          violations.push(
            `[${label}/daraltılmış] yazma sırasında başlık kaydı: ${beforeShrink.titleTop.toFixed(1)} -> ${afterShrink.titleTop.toFixed(1)}`
          );
        }
      }
      if (beforeShrink.inputTop !== null && afterShrink.inputTop !== null) {
        if (Math.abs(afterShrink.inputTop - beforeShrink.inputTop) > 1) {
          violations.push(
            `[${label}/daraltılmış] yazma sırasında arama kutusu kaydı: ${beforeShrink.inputTop.toFixed(1)} -> ${afterShrink.inputTop.toFixed(1)}`
          );
        }
      }

      // Liste kaydırıldığında sabit bloğun top'u değişmemeli.
      const scrolled = await page.evaluate(() => {
        const scrollRegion = document.querySelector('[role="dialog"] .overflow-y-auto');
        const input = document.querySelector('[role="dialog"] input[type="text"]');
        if (!scrollRegion || !input) return null;
        scrollRegion.scrollTop = 200;
        return input.getBoundingClientRect().top;
      });
      if (scrolled !== null && afterShrink.inputTop !== null && Math.abs(scrolled - afterShrink.inputTop) > 1) {
        violations.push(
          `[${label}/daraltılmış] liste kaydırıldığında arama kutusu kaydı: ${afterShrink.inputTop.toFixed(1)} -> ${scrolled.toFixed(1)}`
        );
      }

      console.log(`  [${label}] sabit blok konumu yazma ve daraltma boyunca sabit kaldı.`);
    } catch (err) {
      violations.push(`[location-sheet-keyboard/${label}] check threw: ${err.message}`);
    } finally {
      await context.close();
    }
  }
}

/**
 * design-refresh-v3 Faz 24 Commit 5 — hedef: 360x640'ta (en küçük hedef
 * viewport) ana ekran hiç scroll gerektirmeden sığsın. main artık (Faz 24
 * Commit 1) tek scroll konteyneri olduğu için document.documentElement
 * zaten scroll etmiyor — asıl ölçüm main.scrollHeight <= main.clientHeight.
 */
async function checkFocusScreenFitsWithoutScroll(browser) {
  console.log('\n=== Ana ekran: 3 viewport\'ta scroll\'suz sığma testi ===');
  const viewports = [
    { width: 360, height: 640 },
    { width: 390, height: 844 },
    { width: 412, height: 915 },
  ];
  for (const viewport of viewports) {
    const label = `${viewport.width}x${viewport.height}`;
    const context = await browser.newContext({ viewport, locale: 'tr-TR', timezoneId: 'Europe/Istanbul' });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    try {
      await page.clock.install({ time: new Date(SCENARIOS[0].time).getTime() });
      await page.goto(BASE_URL, { waitUntil: 'load', timeout: 20000 });
      await page.waitForTimeout(600);

      const { scrollHeight, clientHeight } = await page.evaluate(() => {
        const main = document.querySelector('main');
        return { scrollHeight: main.scrollHeight, clientHeight: main.clientHeight };
      });
      if (scrollHeight > clientHeight) {
        violations.push(
          `[${label}] ana ekran scroll gerektiriyor: main.scrollHeight=${scrollHeight} > clientHeight=${clientHeight}`
        );
      } else {
        console.log(`  [${label}] ana ekran scroll'suz sığıyor (scrollHeight=${scrollHeight} <= clientHeight=${clientHeight}).`);
      }
    } catch (err) {
      violations.push(`[focus-fit/${label}] check threw: ${err.message}`);
    } finally {
      await context.close();
    }
  }
}

/**
 * Faz 25 Commit 2 — Faz 24 Commit 5 shrank the ring shell to
 * min(48vw,16dvh) but SunArcDial's <svg> still renders at its hardcoded
 * default size=288, since no caller ever passes a `size` prop. On real
 * phone viewports min(48vw,16dvh) is far below 288px, so the visible ring
 * overflows its shell while the countdown text (absolute inset-0, scoped
 * to the shell) stays correctly small — the two visually disagree ("taşmış
 * / bozuk"). This check catches both symptoms directly: the <svg>'s
 * rendered box must not exceed its shell, and the countdown text box must
 * not overflow itself (scrollWidth/Height <= clientWidth/Height) with its
 * full HH:mm:ss text intact.
 *
 * Faz 25 Commit 2 fix — the checks above never caught the regression a real
 * screenshot showed (ring ~150px, countdown text ~200px wide, spilling
 * outside it). Reason: the countdown div has no width constraint of its
 * own (flex-centered, sized to content), so `scrollWidth > clientWidth`
 * never fires — an unconstrained element doesn't overflow itself, it just
 * grows past whatever visually contains it. The missing assertion is the
 * countdown's rendered box against the *shell's* box, not against its own.
 * Also adds a floor on the shell itself (>= MIN_RING_WIDTH_PX): without
 * it, a regression that satisfies "countdown <= shell" by shrinking both
 * toward zero would still pass. 160, not the originally-proposed 200: a
 * real production-build measurement at 360x640 (the shortest of the 3
 * viewports here) showed the ring-vs-scroll-fit tradeoff bottoms out at
 * 160px — main.scrollHeight matches clientHeight exactly there, and every
 * px above it turns into page scroll (checkFocusScreenFitsWithoutScroll).
 */
const MIN_RING_WIDTH_PX = 160;

async function checkRingContentFitsRing(browser) {
  console.log('\n=== Halka: SVG kapsayıcısını aşmıyor, vakit metni kırpılmıyor (3 viewport) ===');
  const viewports = [
    { width: 360, height: 640 },
    { width: 390, height: 844 },
    { width: 412, height: 915 },
  ];
  for (const viewport of viewports) {
    const label = `${viewport.width}x${viewport.height}`;
    const context = await browser.newContext({ viewport, locale: 'tr-TR', timezoneId: 'Europe/Istanbul' });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    try {
      await page.clock.install({ time: new Date(SCENARIOS[0].time).getTime() });
      await page.goto(BASE_URL, { waitUntil: 'load', timeout: 20000 });
      await page.waitForTimeout(600);

      const result = await page.evaluate(() => {
        const shell = document.querySelector('[data-testid="ring-shell"]');
        const svg = shell?.querySelector('svg');
        const countdown = document.querySelector('[data-testid="countdown"]');
        const shellRect = shell.getBoundingClientRect();
        const svgRect = svg.getBoundingClientRect();
        const countdownRect = countdown.getBoundingClientRect();
        return {
          shellWidth: shellRect.width,
          shellHeight: shellRect.height,
          svgWidth: svgRect.width,
          svgHeight: svgRect.height,
          countdownRectWidth: countdownRect.width,
          countdownRectHeight: countdownRect.height,
          countdownScrollWidth: countdown.scrollWidth,
          countdownClientWidth: countdown.clientWidth,
          countdownScrollHeight: countdown.scrollHeight,
          countdownClientHeight: countdown.clientHeight,
          countdownText: countdown.textContent ?? '',
        };
      });

      const TOLERANCE_PX = 1;
      if (result.svgWidth > result.shellWidth + TOLERANCE_PX || result.svgHeight > result.shellHeight + TOLERANCE_PX) {
        violations.push(
          `[ring-fit/${label}] SVG (${result.svgWidth.toFixed(1)}x${result.svgHeight.toFixed(1)}) halka kapsayıcısını (${result.shellWidth.toFixed(1)}x${result.shellHeight.toFixed(1)}) aşıyor`
        );
      }
      // Countdown metninin kendi kutusuyla karşılaştırması (aşağıda) onu
      // asla yakalayamaz — kutu içeriğe göre büyüyor. Asıl testin halka
      // kabuğuna göre yapılması gerekiyor.
      if (result.countdownRectWidth > result.shellWidth + TOLERANCE_PX) {
        violations.push(
          `[ring-fit/${label}] vakit metni (${result.countdownRectWidth.toFixed(1)}px) halka kabuğunu (${result.shellWidth.toFixed(1)}px) yatayda aşıyor`
        );
      }
      if (result.countdownRectHeight > result.shellHeight + TOLERANCE_PX) {
        violations.push(
          `[ring-fit/${label}] vakit metni (${result.countdownRectHeight.toFixed(1)}px) halka kabuğunu (${result.shellHeight.toFixed(1)}px) dikeyde aşıyor`
        );
      }
      if (result.shellWidth < MIN_RING_WIDTH_PX - TOLERANCE_PX || result.shellHeight < MIN_RING_WIDTH_PX - TOLERANCE_PX) {
        violations.push(
          `[ring-fit/${label}] halka kabuğu (${result.shellWidth.toFixed(1)}x${result.shellHeight.toFixed(1)}) alt sınırın (${MIN_RING_WIDTH_PX}px) altında`
        );
      }
      if (result.countdownScrollWidth > result.countdownClientWidth + TOLERANCE_PX) {
        violations.push(
          `[ring-fit/${label}] vakit metni yatayda taşıyor: scrollWidth=${result.countdownScrollWidth} > clientWidth=${result.countdownClientWidth}`
        );
      }
      if (result.countdownScrollHeight > result.countdownClientHeight + TOLERANCE_PX) {
        violations.push(
          `[ring-fit/${label}] vakit metni dikeyde taşıyor: scrollHeight=${result.countdownScrollHeight} > clientHeight=${result.countdownClientHeight}`
        );
      }
      if (!/^\d{2}:\d{2}:\d{2}$/.test(result.countdownText.trim())) {
        violations.push(`[ring-fit/${label}] vakit metni kırpılmış/beklenmedik: "${result.countdownText}"`);
      }
      if (violations.length === 0 || !violations[violations.length - 1].startsWith(`[ring-fit/${label}]`)) {
        console.log(
          `  [${label}] halka (${result.svgWidth.toFixed(1)}x${result.svgHeight.toFixed(1)}) kapsayıcısına (${result.shellWidth.toFixed(1)}x${result.shellHeight.toFixed(1)}) sığıyor, metin "${result.countdownText}" kırpılmadan görünüyor.`
        );
      }
    } catch (err) {
      violations.push(`[ring-fit/${label}] check threw: ${err.message}`);
    } finally {
      await context.close();
    }
  }
}

/**
 * design-refresh-v3 Faz 24 Commit 6 (B) — the active/upcoming kerahet arc
 * must be at full opacity and pulse (motion.path animating opacity in a
 * loop), and that pulse must NOT run under prefers-reduced-motion: reduce
 * (opacity stays static instead). Measures actual computed opacity at two
 * points in time to detect oscillation, rather than trusting that the
 * animate prop was written correctly.
 */
async function checkKerahetDialArcPulse(browser) {
  console.log('\n=== Halkadaki kerahet yayı: aktif nabız + prefers-reduced-motion ===');
  // İstivâ kerahet (12:30-13:15 per SCENARIOS[0]/ogle's location+date) — mid-window.
  const duringIstiva = new Date('2026-08-01T12:45:00');

  for (const reducedMotion of [false, true]) {
    const label = reducedMotion ? 'prefers-reduced-motion: reduce' : 'normal';
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      locale: 'tr-TR',
      timezoneId: 'Europe/Istanbul',
      reducedMotion: reducedMotion ? 'reduce' : 'no-preference',
    });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    try {
      await page.clock.install({ time: duringIstiva.getTime() });
      await page.goto(BASE_URL, { waitUntil: 'load', timeout: 20000 });
      await page.waitForTimeout(600);

      const readOpacity = () =>
        page.evaluate(() => {
          // İstivâ = 'ogle_oncesi' — the window active at 12:45. Selected by
          // its own data-kerahet-type attribute (SunArcDial.tsx), not by
          // guessing which arc is "currently high opacity" — that would be
          // circular during the low point of the very pulse being measured.
          const el = document.querySelector('svg path[data-kerahet-type="ogle_oncesi"]');
          return el ? parseFloat(getComputedStyle(el).opacity) : null;
        });

      const first = await readOpacity();
      // The pulse is a native CSS @keyframes animation (index.css,
      // .animate-kerahet-pulse), not a Motion/JS-driven one — an earlier
      // attempt using Motion's `animate` array + `repeat: Infinity` never
      // actually attached a running animation in a real browser
      // (el.getAnimations() stayed empty; opacity froze at 1). CSS
      // animations run on the compositor's own timeline, independent of
      // page.clock's faked Date/rAF, so a REAL wait is required here (a
      // page.clock.runFor tick does not advance it).
      await page.waitForTimeout(900);
      const second = await readOpacity();

      if (first === null || second === null) {
        violations.push(`[kerahet-pulse/${label}] aktif kerahet yayı bulunamadı (İstivâ 12:45'te aktif olmalı)`);
        continue;
      }

      const changed = Math.abs(first - second) > 0.05;
      if (reducedMotion && changed) {
        violations.push(
          `[kerahet-pulse/${label}] prefers-reduced-motion altında opaklık hâlâ değişiyor: ${first.toFixed(2)} -> ${second.toFixed(2)}`
        );
      } else if (!reducedMotion && !changed) {
        violations.push(
          `[kerahet-pulse/${label}] nabız animasyonu gözlenmedi: opaklık sabit kaldı (${first.toFixed(2)})`
        );
      } else {
        console.log(`  [${label}] beklenen davranış: opaklık ${changed ? 'değişti (nabız çalışıyor)' : 'sabit (animasyon kapalı)'}.`);
      }
    } catch (err) {
      violations.push(`[kerahet-pulse/${label}] check threw: ${err.message}`);
    } finally {
      await context.close();
    }
  }
}

async function checkTabTransitionStability(browser) {
  console.log('\n=== Sekme geçişinde layout kayması testi ===');
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'tr-TR', timezoneId: 'Europe/Istanbul' });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  try {
    await page.clock.install({ time: new Date(SCENARIOS[0].time).getTime() });
    await page.goto(BASE_URL, { waitUntil: 'load', timeout: 20000 });
    await page.waitForTimeout(600);

    // Reference "settled" geometry per tab — captured with no transition in
    // flight. Ceilings for BOTH the <main> scroll container and the
    // document root (html/body must never become a second scroller) are
    // whichever of the two tabs involved in a switch is legitimately taller
    // — mode="wait" guarantees only one panel is ever mounted at a time.
    const settled = {};
    for (const tab of TABS) {
      await page.getByRole('tab', { name: tab.label }).click();
      await page.waitForTimeout(500);
      settled[tab.id] = await page.evaluate(() => ({
        mainScrollHeight: document.querySelector('main').scrollHeight,
        mainClientWidth: document.querySelector('main').clientWidth,
        docScrollHeight: document.documentElement.scrollHeight,
      }));
    }

    let widthValues = new Set();
    let overshootDetail = null;
    let docOvershootDetail = null;

    // All 12 ordered pairs — every tab to every other tab, both directions.
    for (const from of TABS) {
      for (const to of TABS) {
        if (from.id === to.id) continue;
        await page.getByRole('tab', { name: from.label }).click();
        await page.waitForTimeout(250);
        await page.getByRole('tab', { name: to.label }).click();
        for (let t = 0; t < 30; t++) {
          const sample = await page.evaluate(() => ({
            clientWidth: document.querySelector('main').clientWidth,
            scrollHeight: document.querySelector('main').scrollHeight,
            docScrollHeight: document.documentElement.scrollHeight,
          }));
          widthValues.add(sample.clientWidth);
          const ceiling = Math.max(settled[to.id].mainScrollHeight, settled[from.id].mainScrollHeight);
          // design-refresh-v3 Faz 24 Commit 1 — a real overshoot (the
          // original double-scroll-container bug) was SUSTAINED across
          // multiple consecutive 15ms-apart samples. Investigated with
          // VAKIT_DIAGNOSE3-style instrumentation: an occasional single-tick
          // overshoot reading (same 1787-over-1513 numbers, on various
          // pairs) turned out to self-correct on an IMMEDIATE re-read within
          // the same instant — main's own scrollContainers/panels query,
          // evaluated microseconds later in the SAME diagnostic dump,
          // already showed the correct settled value and exactly one
          // mounted panel with the correct offsetHeight. That means
          // page.evaluate() occasionally forces a layout read at a
          // mid-reflow instant that never corresponds to an actually
          // painted frame (browsers only paint fully-settled layouts) — a
          // measurement artifact of polling via Playwright's CDP
          // round-trips, not something a real user could ever see. A
          // one-shot immediate re-read distinguishes the two: real
          // overshoots reproduce on it, this artifact doesn't.
          if (sample.scrollHeight > ceiling && !overshootDetail) {
            const confirm = await page.evaluate(() => document.querySelector('main').scrollHeight);
            if (confirm > ceiling) {
              overshootDetail = `${from.id}->${to.id}: main.scrollHeight=${sample.scrollHeight} (confirmed ${confirm}) > ceiling=${ceiling} @ t=${t * 15}ms`;
            }
          }
          // document.documentElement must never become a scroll container
          // of its own — its scrollHeight must never exceed whichever of
          // the two tabs' own settled document heights is larger.
          const docCeiling = Math.max(settled[to.id].docScrollHeight, settled[from.id].docScrollHeight);
          if (sample.docScrollHeight > docCeiling && !docOvershootDetail) {
            const confirm = await page.evaluate(() => document.documentElement.scrollHeight);
            if (confirm > docCeiling) {
              docOvershootDetail = `${from.id}->${to.id}: document.scrollHeight=${sample.docScrollHeight} (confirmed ${confirm}) > ceiling=${docCeiling} @ t=${t * 15}ms`;
            }
          }
          await page.waitForTimeout(15);
        }
      }
    }

    if (widthValues.size > 1) {
      violations.push(
        `[tab-transition] içerik kapsayıcısının genişliği geçiş sırasında değişti: ${[...widthValues].join(', ')}`
      );
    }
    if (overshootDetail) {
      violations.push(`[tab-transition] main.scrollHeight geçici olarak gerçek içerikten büyüdü: ${overshootDetail}`);
    }
    if (docOvershootDetail) {
      violations.push(`[tab-transition] document.scrollHeight geçici olarak gerçek içerikten büyüdü (html/body ikinci bir scroll konteyneri oldu): ${docOvershootDetail}`);
    }
    if (widthValues.size <= 1 && !overshootDetail && !docOvershootDetail) {
      console.log('  12 sekme çifti (her iki yön) boyunca içerik genişliği sabit, main/document scrollHeight hiçbir anda gerçek içeriği aşmadı.');
    }
  } catch (err) {
    violations.push(`[tab-transition] check threw: ${err.message}`);
  } finally {
    await context.close();
  }
}

/**
 * design-refresh-v3 Faz 25 — regression guard for the risk design-refresh-v3
 * Faz 24 Commit 1's own commit message flagged but never actually verified:
 * making <main> the app's only scroll container (html/body set to
 * overflow:hidden) removed the second-scroll-container bug that
 * checkTabTransitionStability guards against, but nothing confirmed the
 * ONE remaining container can still really scroll in every tab. This checks
 * the opposite failure mode — a real, physical scroll attempt (programmatic
 * scrollTop, same mechanism a mouse-wheel/trackpad gesture ultimately
 * drives) on whichever tab currently has content taller than the viewport,
 * across all 3 required breakpoints and both motion preferences (Faz 24
 * Commit 1's y:8 mount transform was removed in favor of opacity-only
 * precisely so reduced-motion users hit the identical layout path — this
 * confirms that held for scrollability too, not just the width/height
 * checks checkTabTransitionStability already covers).
 */
async function checkMainScrollFunctional(browser) {
  console.log('\n=== <main> gerçekten kaydırılabiliyor mu testi ===');
  const viewports = [
    { width: 360, height: 640 },
    { width: 390, height: 844 },
    { width: 412, height: 915 },
  ];
  for (const viewport of viewports) {
    for (const reducedMotion of [false, true]) {
      const label = `${viewport.width}x${viewport.height}${reducedMotion ? ' azaltılmış-hareket' : ''}`;
      const context = await browser.newContext({
        viewport,
        locale: 'tr-TR',
        timezoneId: 'Europe/Istanbul',
        reducedMotion: reducedMotion ? 'reduce' : 'no-preference',
      });
      const page = await context.newPage();
      page.setDefaultTimeout(10000);
      try {
        await page.clock.install({ time: new Date(SCENARIOS[0].time).getTime() });
        await page.goto(BASE_URL, { waitUntil: 'load', timeout: 20000 });
        await page.waitForTimeout(600);

        for (const tab of TABS) {
          await page.getByRole('tab', { name: tab.label }).click();
          await page.waitForTimeout(500);

          const result = await page.evaluate(() => {
            const main = document.querySelector('main');
            const overflows = main.scrollHeight > main.clientHeight;
            if (!overflows) return { overflows, scrolled: null };
            main.scrollTop = 999999;
            const scrolled = main.scrollTop > 0;
            main.scrollTop = 0;
            return { overflows, scrolled };
          });

          if (result.overflows && !result.scrolled) {
            violations.push(
              `[main-scroll/${label}] "${tab.label}" sekmesinde içerik taşıyor (scrollHeight>clientHeight) ama main.scrollTop=0'da kilitli kaldı — kaydırma çalışmıyor.`
            );
          } else if (result.overflows) {
            console.log(`  [${label}] "${tab.label}" taşıyor ve gerçekten kaydırılabiliyor.`);
          } else {
            console.log(`  [${label}] "${tab.label}" bu viewport'ta taşmıyor (kaydırma test edilemedi, atlandı).`);
          }
        }
      } catch (err) {
        violations.push(`[main-scroll/${label}] check threw: ${err.message}`);
      } finally {
        await context.close();
      }
    }
  }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  console.log('Scanning src/ for raw Tailwind palette colors...');
  await scanForbiddenColors(path.resolve('src'));

  console.log('Building...');
  // Fake but well-formed support config so the "Destek Ol" sheet (IBAN row,
  // copy button, payment/store links) renders and gets its usual contrast/
  // touch-target/overflow coverage below — the real default (no env vars
  // set) swaps that button for a plain "Uygulamayı Paylaş" share action
  // with no sheet at all (design-refresh-v3 Faz 6 B2), which would leave
  // the sheet's own UI completely unchecked here.
  await run('npm', ['run', 'build'], {
    VITE_SUPPORT_IBAN: 'TR00 0000 0000 0000 0000 0000 00',
    VITE_SUPPORT_NAME: 'Test Kullanıcı',
    VITE_SUPPORT_PAYMENT_URL: 'https://example.com/destek-ol',
    VITE_SUPPORT_STORE_URL: 'https://play.google.com/store/apps/details?id=test',
    // FeedbackModal'ın gerçek formunu (metin alanı + Gönder bağlantısı)
    // değil de "yapılandırılmadı" uyarısını kontrol etmiş olmamak için —
    // aksi halde bu ekranın gerçek arayüzü hiç denetlenmezdi.
    VITE_PRIVACY_CONTACT_EMAIL: 'test@example.com',
  });

  console.log('Starting preview server on port', PORT, '...');
  const preview = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
  });
  preview.stdout.on('data', (d) => process.stdout.write(`[preview] ${d}`));
  preview.stderr.on('data', (d) => process.stderr.write(`[preview] ${d}`));

  try {
    await waitForServer(BASE_URL);

    const browser = await chromium.launch({ channel: 'chrome', headless: true });

    // A thrown error anywhere in the scenario loop (a selector timeout, a
    // failed assertion helper, etc.) must not skip browser.close() — an
    // open Chromium connection keeps Node's event loop alive indefinitely,
    // so an uncaught mid-loop error previously hung this whole script
    // forever instead of failing loudly (caught the hard way: a real
    // selector mismatch here produced a run that looked identical to a
    // genuine hang, with near-zero CPU, for as long as it was left running).
    try {
      for (const scenario of SCENARIOS) {
        console.log(`\n=== Scenario: ${scenario.name} (${scenario.time}) ===`);
        const context = await browser.newContext({
          viewport: { width: 390, height: 844 },
          deviceScaleFactor: 3,
          locale: 'tr-TR',
          timezoneId: 'Europe/Istanbul',
        });
        const page = await context.newPage();
        page.setDefaultTimeout(10000); // safety net: no single action hangs indefinitely
        const fixedTime = new Date(scenario.time).getTime();
        await page.clock.install({ time: fixedTime });

        // 'load' not 'networkidle': this app registers a Service Worker and
        // does periodic background fetches (push, daily verse), so
        // networkidle can hang indefinitely waiting for a quiet period that
        // never comes.
        await page.goto(BASE_URL, { waitUntil: 'load', timeout: 20000 });
        await page.waitForTimeout(600); // fonts / entrance animations settle

        for (const tab of TABS) {
          await page.getByRole('tab', { name: tab.label }).click();
          await page.waitForTimeout(500);

          await checkScreen(page, scenario, tab.id);

          // Countdown width only applies to the focus tab's dial.
          if (tab.id === 'focus') {
            const countdownWidth = await page.evaluate(() => {
              const el = document.querySelector('[data-testid="countdown"]');
              return el ? el.getBoundingClientRect().width : null;
            });
            if (countdownWidth !== null && countdownWidth > COUNTDOWN_MAX_WIDTH) {
              violations.push(
                `[${scenario.name}/${tab.id}] countdown width=${countdownWidth.toFixed(1)}px > ${COUNTDOWN_MAX_WIDTH}px`
              );
            } else if (countdownWidth === null) {
              violations.push(`[${scenario.name}/${tab.id}] countdown element not found (data-testid="countdown")`);
            }
          }
        }

        // Zikirmatik modal: not a tab, only reachable via the Header button,
        // so it needs its own explicit check — the dhikr-chip row previously
        // relied on hidden horizontal scroll (design-refresh-v3 Faz 2 F3) and
        // was never exercised by the per-tab loop above.
        await page.getByRole('button', { name: 'Zikirmatik' }).click();
        await page.waitForTimeout(500);
        await checkScreen(page, scenario, 'zikirmatik');
        await page.keyboard.press('Escape');
        await waitForDialogClosed(page);

        // Destek Ol sheet: reached from Ayarlar > Hakkında, also not a tab.
        // The build below sets VITE_SUPPORT_* so this button is in its
        // "has a payment method" form (label "Destek Ol", opens a sheet) —
        // otherwise (no env vars, the real production default) it reads
        // "Uygulamayı Paylaş" and shares directly instead of opening a
        // sheet (design-refresh-v3 Faz 6 B2), and there'd be no sheet here
        // to check.
        await page.getByRole('tab', { name: 'Ayarlar' }).click();
        await page.waitForTimeout(500);
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(1000);
        await page.getByRole('button', { name: 'Destek Ol' }).click();
        await page.waitForTimeout(500);
        await checkScreen(page, scenario, 'destek');
        await page.keyboard.press('Escape');
        await waitForDialogClosed(page);

        // Hakkında sheet: design-refresh-v3 Faz 20 madde 4, Ayarlar >
        // Hakkında bölümünden, tab değil — kendi checkScreen'i olmadan bu
        // ekran hiç denetlenmezdi.
        await page.getByRole('tab', { name: 'Ayarlar' }).click();
        await page.waitForTimeout(500);
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(800);
        await page.getByRole('button', { name: 'Hakkında sayfasını aç →' }).click();
        await page.waitForTimeout(500);
        await checkScreen(page, scenario, 'hakkinda');

        // Lisanslar sheet: design-refresh-v3 Faz 21 madde 3, Hakkında
        // içinden hâlâ açık olan sheet üzerinden — kendi entry point'i
        // Ayarlar seviyesinde yok, sadece Hakkında'dan.
        await page.getByRole('button', { name: 'Lisanslar (tam metin) →' }).click();
        await page.waitForTimeout(500);
        // Expand one license row first — the collapsed list alone wouldn't
        // exercise the long, pre-formatted MIT text most likely to overflow.
        await page.getByRole('button', { name: /^react\s/ }).first().click();
        await page.waitForTimeout(300);
        await checkScreen(page, scenario, 'lisanslar');
        await page.keyboard.press('Escape');
        await waitForDialogClosed(page);

        // Geri Bildirim sheet: design-refresh-v3 Faz 20 madde 5, aynı
        // şekilde Ayarlar > Hakkında bölümünden, tab değil.
        await page.getByRole('button', { name: 'Geri bildirim gönder →' }).click();
        await page.waitForTimeout(500);
        await checkScreen(page, scenario, 'geri-bildirim');
        await page.keyboard.press('Escape');
        await waitForDialogClosed(page);

        // 320px pass: touch-target/overlap only (design-refresh-v3 Faz 3 F4)
        // — controls that clear 44px with room to spare at 390px can end up
        // with overlapping invisible ::before zones once the viewport (and
        // therefore the gaps between them) shrinks. Screenshots/contrast
        // aren't re-run here; only hit-area geometry changes with width.
        await page.setViewportSize({ width: 320, height: 844 });
        await page.waitForTimeout(300);
        for (const tab of TABS) {
          await page.getByRole('tab', { name: tab.label }).click();
          await page.waitForTimeout(400);
          await checkTouchTargets(page, scenario, `${tab.id}-320px`);
        }
        await page.getByRole('button', { name: 'Zikirmatik' }).click();
        await page.waitForTimeout(400);
        await checkTouchTargets(page, scenario, 'zikirmatik-320px');
        await page.keyboard.press('Escape');
        await waitForDialogClosed(page);
        await page.getByRole('tab', { name: 'Ayarlar' }).click();
        await page.waitForTimeout(400);
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(800);
        await page.getByRole('button', { name: 'Destek Ol' }).click();
        await page.waitForTimeout(400);
        await checkTouchTargets(page, scenario, 'destek-320px');
        await page.keyboard.press('Escape');
        await waitForDialogClosed(page);
        await page.getByRole('button', { name: 'Hakkında sayfasını aç →' }).click();
        await page.waitForTimeout(400);
        await checkTouchTargets(page, scenario, 'hakkinda-320px');
        await page.getByRole('button', { name: 'Lisanslar (tam metin) →' }).click();
        await page.waitForTimeout(400);
        await checkTouchTargets(page, scenario, 'lisanslar-320px');
        await page.keyboard.press('Escape');
        await waitForDialogClosed(page);
        await page.getByRole('button', { name: 'Geri bildirim gönder →' }).click();
        await page.waitForTimeout(400);
        await checkTouchTargets(page, scenario, 'geri-bildirim-320px');
        await page.keyboard.press('Escape');
        await waitForDialogClosed(page);

        await context.close();
      }

      await checkOfflineSupport(browser);
      await checkServerlessScenario(browser);
      await checkSpaFallbackRegression(browser);
      await checkLocationSearchFocusRegression(browser);
      await checkInteractionSweep(browser);
      await checkGpsLocationLabelHonesty(browser);
      await checkRamadanMode(browser);
      await checkNavbarLegibility(browser);
      await checkTabTransitionStability(browser);
      await checkMainScrollFunctional(browser);
      await checkLocationSheetKeyboardStability(browser);
      await checkFocusScreenFitsWithoutScroll(browser);
      await checkRingContentFitsRing(browser);
      await checkKerahetDialArcPulse(browser);
    } finally {
      await browser.close();
    }
  } finally {
    // preview.kill() alone only signals the immediate `npx` shell wrapper
    // on Windows, not the actual vite process it spawned underneath —
    // leaves an orphaned server holding the port for the next run.
    if (process.platform === 'win32' && preview.pid) {
      spawn('taskkill', ['/pid', String(preview.pid), '/T', '/F'], { stdio: 'ignore', shell: true });
    } else {
      preview.kill();
    }
  }

  console.log('\n=== SUMMARY ===');
  if (violations.length === 0) {
    console.log('All checks passed.');
    process.exitCode = 0;
  } else {
    console.log(`${violations.length} violation(s):\n`);
    for (const v of violations) console.log(' - ' + v);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
