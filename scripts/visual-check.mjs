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

const PORT = 4174;
const BASE_URL = `http://localhost:${PORT}`;
const OUT_DIR = path.resolve('.visual');
const COUNTDOWN_MAX_WIDTH = 210;

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

        const screenshotPath = path.join(OUT_DIR, `${scenario.name}-${tab.id}.png`);
        // fullPage screenshots "stamp" position:fixed elements (the Navbar)
        // at every viewport-height interval down the page — a Playwright/
        // Chromium capture artifact, not something a real scrolling user
        // sees (the fixed navbar only ever renders once, pinned to the
        // viewport bottom). Hide it just for the capture.
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
            `[${scenario.name}/${tab.id}] ${issue.kind}: <${issue.tag} class="${describeElement(issue.cls)}"> ` +
              `value=${issue.value.toFixed?.(1) ?? issue.value} clientWidth=${issue.clientWidth ?? 'n/a'}`
          );
        }

        // 3: countdown width
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

        // 4: every visible, enabled button is actually clickable (no pointer-events
        // blocker on top). Explicitly-disabled buttons (e.g. PrayerTracker's future
        // prayers) are SUPPOSED to reject clicks — that's not a bug to flag.
        const buttons = await page.$$('button:visible:not([disabled])');
        for (const handle of buttons) {
          try {
            await handle.click({ trial: true, timeout: 2000 });
          } catch (err) {
            const info = await handle.evaluate(
              (el) => `aria-label="${el.getAttribute('aria-label') ?? ''}" class="${el.className}"`
            );
            violations.push(
              `[${scenario.name}/${tab.id}] button not clickable: <button ${info}> — ${String(err.message).split('\n')[0]}`
            );
          }
        }
      }

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
