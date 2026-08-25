import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { hexToRgb, contrastRatio, compositeOver } from './contrast';

// Faz 27.16 — regression guard for the WCAG AA (4.5:1) floor on the text
// tokens flagged as "too light on cream": passive kerahet chips, the
// location coordinate line, and the hicri (gold) date. Reads the live
// values out of index.css (not hardcoded copies) so a future token edit
// that silently regresses contrast fails this test instead of shipping.
const cssPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../index.css');
const css = readFileSync(cssPath, 'utf8');

function extractBlock(selector: string): string {
  const escaped = selector.replace(/[.]/g, '\\.');
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 's'));
  assert.ok(match, `${selector} block not found in index.css`);
  return match[1];
}

function extractVar(block: string, name: string): string {
  const match = block.match(new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})\\s*;`));
  assert.ok(match, `--${name} not found or not a literal hex color`);
  return match[1];
}

const rootBlock = extractBlock(':root');
const darkBlock = extractBlock('.dark');

const TOKENS = ['paper', 'card-bg', 'ink', 'mist', 'gold-ink'] as const;

function readTheme(block: string) {
  const values = Object.fromEntries(TOKENS.map((name) => [name, extractVar(block, name)])) as Record<
    (typeof TOKENS)[number],
    string
  >;
  return {
    paper: hexToRgb(values.paper),
    card: hexToRgb(values['card-bg']),
    ink: hexToRgb(values.ink),
    mist: hexToRgb(values.mist),
    goldInk: hexToRgb(values['gold-ink']),
  };
}

const themes = {
  light: readTheme(rootBlock),
  dark: readTheme(darkBlock),
};

const AA_NORMAL = 4.5;

for (const [themeName, theme] of Object.entries(themes)) {
  const surfaces = { paper: theme.paper, card: theme.card };

  for (const [surfaceName, surface] of Object.entries(surfaces)) {
    test(`${themeName}: ikincil (mist) metin / ${surfaceName} >= 4.5:1 — konum koordinat satırı, kerahet saat aralığı`, () => {
      const ratio = contrastRatio(theme.mist, surface);
      assert.ok(ratio >= AA_NORMAL, `mist/${surfaceName} = ${ratio.toFixed(2)}:1, AA needs >=4.5:1`);
    });

    test(`${themeName}: altın/vurgu (gold-ink) metin / ${surfaceName} >= 4.5:1 — hicri tarih`, () => {
      const ratio = contrastRatio(theme.goldInk, surface);
      assert.ok(ratio >= AA_NORMAL, `gold-ink/${surfaceName} = ${ratio.toFixed(2)}:1, AA needs >=4.5:1`);
    });

    test(`${themeName}: birincil (ink) metin / ${surfaceName} >= 4.5:1 — pasif kerahet chip etiketi`, () => {
      const ratio = contrastRatio(theme.ink, surface);
      assert.ok(ratio >= AA_NORMAL, `ink/${surfaceName} = ${ratio.toFixed(2)}:1, AA needs >=4.5:1`);
    });

    // KerahetStrip used to render its "past" chip at inline opacity:0.4,
    // fading an already-borderline --mist (5.06:1 in light mode) down to
    // ~1.7:1. The fix swapped the past label to plain --mist instead of a
    // faded --ink, and dropped the opacity entirely — this pins that a
    // future re-introduction of opacity-based text fading is caught here.
    test(`${themeName}: composited ink@0.4 / ${surfaceName} would FAIL AA (documents why past-chip opacity fading was removed)`, () => {
      const faded = compositeOver(theme.ink, 0.4, surface);
      const ratio = contrastRatio(faded, surface);
      assert.ok(ratio < AA_NORMAL, `expected ink@0.4/${surfaceName} to be below AA (it was the original bug), got ${ratio.toFixed(2)}:1`);
    });
  }
}
