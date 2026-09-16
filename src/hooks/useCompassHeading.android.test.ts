import { test, before, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import type { QiblaHeadingSample } from '../plugins/qiblaHeading';

/**
 * Kök neden (gerçek cihaz raporu): Android WebView'in
 * `deviceorientationabsolute` olayı (Chromium, ROTATION_VECTOR tabanlı)
 * aynı noktada 35-58° yanlış yön veriyor — açı hesabı (adhan) doğru
 * olmasına rağmen. Bu yüzden Android'de yön artık yerel eklentiden
 * (accelerometer + magnetometer) geliyor ve web listener'ları HİÇ
 * eklenmemeli; "eklenir ama görmezden gelinir" yetmez, iki kaynak
 * birbiriyle yarışırsa hata geri gelir.
 *
 * node:test'te DOM da React de yok; ikisi de mock.module ile taklit
 * ediliyor (bkz. statusBarAppearance.test.ts'teki @capacitor/core mock'u).
 */

// --- Asgari React kanca (hook) koşucusu ----------------------------------
// Gerçek React yerine hücre listesi: her render'da imleç sıfırlanır,
// useState/useRef aynı hücreye düşer, useEffect'ler render sonrası
// senkron çalışır. Kancanın gerçek kodunu (dallanma, cleanup) çalıştırmak
// için yeterli; kancanın kendisi mocklanmıyor.
interface Cell {
  value: unknown;
}
let cells: Cell[] = [];
let cursor = 0;
let pendingEffects: Array<() => void | (() => void)> = [];

function useState<T>(initial: T | (() => T)): [T, (next: T | ((prev: T) => T)) => void] {
  const index = cursor++;
  if (cells[index] === undefined) {
    cells[index] = { value: typeof initial === 'function' ? (initial as () => T)() : initial };
  }
  const cell = cells[index];
  const setter = (next: T | ((prev: T) => T)) => {
    cell.value = typeof next === 'function' ? (next as (prev: T) => T)(cell.value as T) : next;
  };
  return [cell.value as T, setter];
}

function useRef<T>(initial: T): { current: T } {
  const index = cursor++;
  if (cells[index] === undefined) cells[index] = { value: { current: initial } };
  return cells[index].value as { current: T };
}

function useCallback<T>(fn: T): T {
  cursor++;
  return fn;
}

function useEffect(fn: () => void | (() => void)): void {
  pendingEffects.push(fn);
}

let cleanups: Array<() => void> = [];

function render<T>(run: () => T): T {
  cursor = 0;
  pendingEffects = [];
  const result = run();
  cleanups = pendingEffects
    .map((effect) => effect())
    .filter((c): c is () => void => typeof c === 'function');
  return result;
}

function resetHooks(): void {
  cells = [];
  cursor = 0;
  pendingEffects = [];
  cleanups = [];
}

// --- Sahte ortam ---------------------------------------------------------
const platform = { value: 'android' };
const addEventListenerCalls: string[] = [];
const removeEventListenerCalls: string[] = [];
const startCalls: Array<{ lat: number; lng: number }> = [];
const stopCalls = { count: 0 };
const removeCalls = { count: 0 };
const addListenerEvents: string[] = [];
let startRejects = false;
let emit: ((sample: QiblaHeadingSample) => void) | null = null;

const fakeWindow = {
  addEventListener: (type: string) => {
    addEventListenerCalls.push(type);
  },
  removeEventListener: (type: string) => {
    removeEventListenerCalls.push(type);
  },
  setTimeout: (fn: () => void, ms: number) => globalThis.setTimeout(fn, ms),
  clearTimeout: (id: unknown) => globalThis.clearTimeout(id as NodeJS.Timeout),
  screen: { orientation: { angle: 0 } },
};

let useCompassHeading: typeof import('./useCompassHeading').useCompassHeading;

before(async () => {
  (globalThis as unknown as { window: unknown }).window = fakeWindow;

  mock.module('react', {
    namedExports: { useState, useRef, useCallback, useEffect },
  });

  mock.module('@capacitor/core', {
    namedExports: {
      Capacitor: {
        getPlatform: () => platform.value,
        isNativePlatform: () => platform.value !== 'web',
      },
      registerPlugin: () => ({
        start: async (options: { lat: number; lng: number }) => {
          if (startRejects) throw new Error('unsupported');
          startCalls.push(options);
        },
        stop: async () => {
          stopCalls.count++;
        },
        addListener: async (event: string, cb: (sample: QiblaHeadingSample) => void) => {
          addListenerEvents.push(event);
          emit = cb;
          return {
            remove: async () => {
              removeCalls.count++;
            },
          };
        },
      }),
    },
  });

  ({ useCompassHeading } = await import('./useCompassHeading'));
});

beforeEach(() => {
  resetHooks();
  addEventListenerCalls.length = 0;
  removeEventListenerCalls.length = 0;
  addListenerEvents.length = 0;
  startCalls.length = 0;
  stopCalls.count = 0;
  removeCalls.count = 0;
  startRejects = false;
  platform.value = 'android';
  emit = null;
  delete (globalThis as unknown as { DeviceOrientationEvent?: unknown }).DeviceOrientationEvent;
});

const flush = () => new Promise((resolve) => globalThis.setTimeout(resolve, 0));

const BANDIRMA = { lat: 40.3517, lng: 27.9769 };

test('Android: WebView yön olaylarına HİÇ abone olunmaz', async () => {
  render(() => useCompassHeading(true, BANDIRMA.lat, BANDIRMA.lng));
  await flush();

  assert.deepEqual(addEventListenerCalls, []);
});

test('Android: yerel eklenti tam bir kez, verilen konumla başlatılır', async () => {
  render(() => useCompassHeading(true, BANDIRMA.lat, BANDIRMA.lng));
  await flush();

  assert.deepEqual(addListenerEvents, ['heading']);
  assert.equal(startCalls.length, 1);
  assert.deepEqual(startCalls[0], { lat: BANDIRMA.lat, lng: BANDIRMA.lng });
});

test('Android: izin istemeden granted başlar (sensör izni gerektirmez)', async () => {
  const state = render(() => useCompassHeading(true, BANDIRMA.lat, BANDIRMA.lng));
  assert.equal(state.permissionState, 'granted');
});

test('Android: heading, eklentinin headingTrue değeriyle bire bir aynıdır (yumuşatma/telafi yok)', async () => {
  render(() => useCompassHeading(true, BANDIRMA.lat, BANDIRMA.lng));
  await flush();

  emit?.({
    headingTrue: 148.5,
    headingMagnetic: 143.2,
    rvHeadingTrue: 190.3,
    declination: 5.3,
    accuracy: 3,
    fieldUt: 46,
  });

  const next = render(() => useCompassHeading(true, BANDIRMA.lat, BANDIRMA.lng));
  assert.equal(next.heading, 148.5);
  assert.equal(next.debug.source, 'native-accmag');
  assert.equal(next.debug.declination, 5.3);
  assert.equal(next.debug.rvHeadingTrue, 190.3);
  assert.equal(next.reliability, 'ok');
});

test('Android: parazitli alan okuması reliability=interference olarak yansır', async () => {
  render(() => useCompassHeading(true, BANDIRMA.lat, BANDIRMA.lng));
  await flush();

  emit?.({
    headingTrue: 100,
    headingMagnetic: 95,
    rvHeadingTrue: -1,
    declination: 5,
    accuracy: 3,
    fieldUt: 92,
  });

  const next = render(() => useCompassHeading(true, BANDIRMA.lat, BANDIRMA.lng));
  assert.equal(next.reliability, 'interference');
});

test('Android: start reject ederse permissionState unsupported olur', async () => {
  startRejects = true;
  render(() => useCompassHeading(true, BANDIRMA.lat, BANDIRMA.lng));
  await flush();

  const next = render(() => useCompassHeading(true, BANDIRMA.lat, BANDIRMA.lng));
  assert.equal(next.permissionState, 'unsupported');
});

test('Android: temizlikte dinleyici kaldırılır ve stop çağrılır', async () => {
  render(() => useCompassHeading(true, BANDIRMA.lat, BANDIRMA.lng));
  await flush();

  for (const cleanup of cleanups) cleanup();
  await flush();

  assert.equal(removeCalls.count, 1);
  assert.equal(stopCalls.count, 1);
});

// Kontrol testi: yukarıdaki "hiç abone olunmaz" iddiası, kanca zaten hiçbir
// şey yapmadığı için değil, gerçekten Android dalı yüzünden geçmeli.
test('web: mevcut deviceorientation yolu aynen korunur', async () => {
  platform.value = 'web';
  (globalThis as unknown as { DeviceOrientationEvent: unknown }).DeviceOrientationEvent = function () {};

  const state = render(() => useCompassHeading(true, BANDIRMA.lat, BANDIRMA.lng));
  await state.requestPermission();

  const next = render(() => useCompassHeading(true, BANDIRMA.lat, BANDIRMA.lng));
  assert.equal(next.permissionState, 'granted');
  assert.deepEqual(addEventListenerCalls, ['deviceorientationabsolute', 'deviceorientation']);
  assert.equal(next.reliability, 'unknown');
  assert.equal(startCalls.length, 0);
});
