// Real headless-browser verification: navigates the built app, screenshots
// all 4 tabs under 2 fixed-time scenarios (öğle/light, yatsı/dark), and
// asserts real DOM measurements instead of trusting that a clean
// `tsc`/`build` means the UI actually looks right. See design-refresh-v3
// Faz 0 — runtime breakage is invisible to the type checker and bundler.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdir, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import sharp from 'sharp';

const PORT = 4174;
const BASE_URL = `http://localhost:${PORT}`;
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

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', shell: true });
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
    });
  }
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
  // scrolling back to the top for the rest of the checks).
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1000);
  await page.evaluate(() => window.scrollTo(0, 0));

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
  const textEls = await page.evaluate(() => {
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
    return results;
  });

  if (textEls.length > 0) {
    const dpr = await page.evaluate(() => window.devicePixelRatio);
    // Same fullPage-stitching artifact as the saved screenshot: the fixed
    // Navbar must be hidden here too, or it gets stamped over
    // document-flow content near the first-viewport-height mark and
    // corrupts background sampling for whatever real element sits "under"
    // that stamped copy (not under the real, once-only navbar a scrolling
    // user actually sees).
    await page.addStyleTag({ content: '[role="tablist"] { visibility: hidden !important; }' });
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
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  try {
    await page.goto(BASE_URL, { waitUntil: 'load', timeout: 20000 });
    await page.evaluate(() => navigator.serviceWorker.ready);

    // The very first load of a page is never controlled by a worker it
    // just registered (per spec) — only the next navigation is.
    await page.reload({ waitUntil: 'load', timeout: 20000 });
    const controlled = await page.evaluate(() => !!navigator.serviceWorker.controller);
    if (!controlled) {
      violations.push(
        '[offline] page is not controlled by the service worker after a reload — offline support cannot work'
      );
      return;
    }

    await context.setOffline(true);
    await page.waitForTimeout(300); // let in-flight background fetches (push/daily-verse) abort before navigating
    await page.reload({ waitUntil: 'load', timeout: 20000 });

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
    console.log('  All 4 tabs render offline, countdown active.');
  } catch (err) {
    violations.push(`[offline] check threw: ${err.message}`);
  } finally {
    await context.setOffline(false);
    await context.close();
  }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  console.log('Scanning src/ for raw Tailwind palette colors...');
  await scanForbiddenColors(path.resolve('src'));

  console.log('Building...');
  await run('npm', ['run', 'build']);

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
      await page.waitForTimeout(300);

      // Destek Ol sheet: reached from Ayarlar > Hakkında, also not a tab.
      await page.getByRole('tab', { name: 'Ayarlar' }).click();
      await page.waitForTimeout(500);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1000);
      await page.getByRole('button', { name: 'Destek Ol' }).click();
      await page.waitForTimeout(500);
      await checkScreen(page, scenario, 'destek');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);

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
      await page.waitForTimeout(300);
      await page.getByRole('tab', { name: 'Ayarlar' }).click();
      await page.waitForTimeout(400);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(800);
      await page.getByRole('button', { name: 'Destek Ol' }).click();
      await page.waitForTimeout(400);
      await checkTouchTargets(page, scenario, 'destek-320px');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);

      await context.close();
    }

    await checkOfflineSupport(browser);

    await browser.close();
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
