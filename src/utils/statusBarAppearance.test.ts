import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveStatusBarAppearance } from './statusBarAppearance';

test('acik temada (isDarkMode=false) ikonlar koyu olmali', () => {
  assert.deepEqual(resolveStatusBarAppearance(false), { lightStatusBarIcons: false });
});

test('koyu temada (isDarkMode=true) ikonlar acik olmali', () => {
  assert.deepEqual(resolveStatusBarAppearance(true), { lightStatusBarIcons: true });
});
