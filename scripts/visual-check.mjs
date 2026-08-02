// Real headless-browser verification: navigates the built app, screenshots
// all 4 tabs under 2 fixed-time scenarios (öğle/light, yatsı/dark), and
// asserts real DOM measurements instead of trusting that a clean
// `tsc`/`build` means the UI actually looks right. See design-refresh-v3
// Faz 0 — runtime breakage is invisible to the type checker and bundler.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
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

  // 4: touch target size — every visible, enabled clickable control must
  // be >=44x44 (its own box, or an invisible ::before expansion per
  // design-refresh-v3 Faz 2 F2).
  const touchIssues = await page.evaluate((MIN) => {
    const issues = [];
    const clickable = document.querySelectorAll(
      'button:not([disabled]), a[href], [role="button"]:not([aria-disabled="true"])'
    );
    clickable.forEach((el) => {
      if (el.closest('[inert]')) return;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;
      const style = getComputedStyle(el, '::before');
      let effectiveW = rect.width;
      let effectiveH = rect.height;
      if (style.content !== 'none' && style.position === 'absolute') {
        const inset = parseFloat(style.top) || 0;
        effectiveW = rect.width + Math.abs(inset) * 2;
        effectiveH = rect.height + Math.abs(inset) * 2;
      }
      if (effectiveW < MIN || effectiveH < MIN) {
        issues.push({
          tag: el.tagName,
          cls: el.className,
          label: el.getAttribute('aria-label') || el.textContent?.trim().slice(0, 30),
          w: effectiveW,
          h: effectiveH,
        });
      }
    });
    return issues;
  }, MIN_TOUCH_TARGET);
  for (const issue of touchIssues) {
    violations.push(
      `[${scenario.name}/${screenId}] touch target too small: <${issue.tag} class="${describeElement(issue.cls)}"` +
        ` label="${issue.label}"> ${issue.w.toFixed(0)}x${issue.h.toFixed(0)}px < ${MIN_TOUCH_TARGET}x${MIN_TOUCH_TARGET}px`
    );
  }

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
        tag: el.tagName,
        cls: el.className,
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        color: resolveColor(cs.color),
        opacity: parseFloat(cs.opacity) || 1,
        fontSize: parseFloat(cs.fontSize) || 16,
        fontWeight: parseFloat(cs.fontWeight) || 400,
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
      const isLarge = t.fontSize >= 24 || (t.fontSize >= 18.66 && t.fontWeight >= 700);
      const minRatio = isLarge ? CONTRAST_MIN_LARGE : CONTRAST_MIN_NORMAL;
      if (ratio < minRatio) {
        violations.push(
          `[${scenario.name}/${screenId}] low contrast: <${t.tag} class="${describeElement(t.cls)}"> ` +
            `${ratio.toFixed(2)}:1 < ${minRatio}:1 (fontSize=${t.fontSize.toFixed(0)}px weight=${t.fontWeight})`
        );
      }
    }
  }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

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

      await context.close();
    }

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
