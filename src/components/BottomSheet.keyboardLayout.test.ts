import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// BottomSheet is portal-rendered to document.body, which doesn't exist under
// node:test's SSR-only environment — it can't be mounted here. Like
// MainCountdownRing.ringSize.test.ts, this asserts the CSS/JSX declarations
// exist in source; the real pixel/layout outcome needs a real device or
// npm run visual (see also Navbar.safeArea.test.ts for the same limitation
// with env(safe-area-inset-bottom)).
const source = readFileSync(path.join(import.meta.dirname, 'BottomSheet.tsx'), 'utf8');
const cssSource = readFileSync(path.join(import.meta.dirname, '..', 'index.css'), 'utf8');

test('BottomSheet tracks the keyboard via the shared useVisualViewportKeyboard hook', () => {
  assert.match(source, /useVisualViewportKeyboard\(isOpen\)/);
  assert.doesNotMatch(source, /window\.visualViewport/, 'raw visualViewport wiring should live in the hook, not duplicated here');
});

test('sheet max-height backs off to fit the space left after the keyboard, not just a fixed dvh cap', () => {
  assert.match(source, /min\(80dvh,\s*calc\(100dvh - var\(--kb-height, 0px\)\)\)/);
});

test('bottom safe-area padding backs off once the keyboard opens instead of stacking on top of it', () => {
  assert.match(
    source,
    /max\(0px, calc\(env\(safe-area-inset-bottom\) \+ 24px - var\(--kb-height, 0px\)\)\)/
  );
});

test('sheet root stays a single flex column with one flex:1 min-h-0 overflow-y-auto scroll container', () => {
  assert.match(source, /flex flex-col/);
  assert.match(source, /flex-1 min-h-0 overflow-y-auto/);
});

test('no bare vh unit is used for the sheet — dvh only', () => {
  assert.doesNotMatch(source, /\dvh(?!\w)/);
});

test('--kb-height design token defaults to 0px in :root', () => {
  assert.match(cssSource, /--kb-height:\s*0px;/);
});
