import { test, mock, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

test('acik temada (isDarkMode=false) ikonlar koyu olmali', async () => {
  const { resolveStatusBarAppearance } = await import('./statusBarAppearance');
  assert.deepEqual(resolveStatusBarAppearance(false), { lightStatusBarIcons: false });
});

test('koyu temada (isDarkMode=true) ikonlar acik olmali', async () => {
  const { resolveStatusBarAppearance } = await import('./statusBarAppearance');
  assert.deepEqual(resolveStatusBarAppearance(true), { lightStatusBarIcons: true });
});

// applyStatusBarAppearance köprüye dokunur; @capacitor/core'u mockluyoruz
// çünkü node:test ortamında gerçek Capacitor bridge'i yok (platform.test.ts).
const nativeState = { value: false };
const setAppearance = mock.fn(async () => {});

let applyStatusBarAppearance: typeof import('./statusBarAppearance').applyStatusBarAppearance;

before(async () => {
  mock.module('@capacitor/core', {
    namedExports: {
      registerPlugin: () => ({ setAppearance }),
      Capacitor: { isNativePlatform: () => nativeState.value },
    },
  });
  ({ applyStatusBarAppearance } = await import('./statusBarAppearance'));
});

beforeEach(() => {
  setAppearance.mock.resetCalls();
  nativeState.value = false;
});

test('native platformda isDarkMode=true icin bridge tam bir kez { lightStatusBarIcons: true } ile cagrilir', async () => {
  nativeState.value = true;
  await applyStatusBarAppearance(true);
  assert.equal(setAppearance.mock.callCount(), 1);
  assert.deepEqual(setAppearance.mock.calls[0].arguments, [{ lightStatusBarIcons: true }]);
});

test('native platformda isDarkMode=false icin bridge { lightStatusBarIcons: false } ile cagrilir', async () => {
  nativeState.value = true;
  await applyStatusBarAppearance(false);
  assert.equal(setAppearance.mock.callCount(), 1);
  assert.deepEqual(setAppearance.mock.calls[0].arguments, [{ lightStatusBarIcons: false }]);
});

test('native olmayan platformda kopru hic cagrilmaz', async () => {
  nativeState.value = false;
  await applyStatusBarAppearance(true);
  assert.equal(setAppearance.mock.callCount(), 0);
});
