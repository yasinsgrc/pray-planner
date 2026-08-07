import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unsubscribeFromPush, registerServiceWorker } from './pushClient';

interface FakeSubscription {
  endpoint: string;
  unsubscribeCalls: number;
  unsubscribe: () => Promise<boolean>;
  toJSON: () => { keys: { p256dh: string; auth: string } };
}

function makeFakeSubscription(endpoint = 'https://push.example.com/abc'): FakeSubscription {
  const sub: FakeSubscription = {
    endpoint,
    unsubscribeCalls: 0,
    unsubscribe: async () => {
      sub.unsubscribeCalls++;
      return true;
    },
    toJSON: () => ({ keys: { p256dh: 'p', auth: 'a' } }),
  };
  return sub;
}

interface FetchCall {
  url: string;
  init: RequestInit | undefined;
}

/**
 * Stubs the two browser globals unsubscribeFromPush actually touches
 * (navigator.serviceWorker, fetch) — no DOM/jsdom needed since this is a
 * plain async function, not a React hook or component (design-refresh-v3
 * Faz 21 madde 4, explicit user requirement: verify BOTH the real
 * pushManager.unsubscribe() call AND the server DELETE happen, and that a
 * failed DELETE still leaves local state consistent).
 */
function installFakeBrowserGlobals(options: {
  subscription: FakeSubscription | null;
  fetchImpl?: (url: string, init?: RequestInit) => Promise<{ ok: boolean }>;
}) {
  const fetchCalls: FetchCall[] = [];
  const fetchImpl =
    options.fetchImpl ??
    (async () => ({ ok: true }));

  const wrappedFetch = async (url: string, init?: RequestInit) => {
    fetchCalls.push({ url, init });
    return fetchImpl(url, init);
  };

  const originalFetch = globalThis.fetch;
  const originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

  (globalThis as unknown as { fetch: unknown }).fetch = wrappedFetch;
  // Node 21+ defines a built-in, getter-only `navigator` global — a plain
  // assignment throws. Redefining the property (not just setting it) is
  // required to stub it out for this test.
  Object.defineProperty(globalThis, 'navigator', {
    value: {
      serviceWorker: {
        getRegistration: async () => ({
          pushManager: { getSubscription: async () => options.subscription },
        }),
      },
    },
    configurable: true,
    writable: true,
  });

  return {
    fetchCalls,
    restore: () => {
      (globalThis as unknown as { fetch: unknown }).fetch = originalFetch;
      if (originalNavigatorDescriptor) {
        Object.defineProperty(globalThis, 'navigator', originalNavigatorDescriptor);
      }
    },
  };
}

test('unsubscribeFromPush calls both pushManager.unsubscribe() and the server DELETE', async () => {
  const subscription = makeFakeSubscription('https://push.example.com/xyz');
  const { fetchCalls, restore } = installFakeBrowserGlobals({ subscription });
  try {
    const result = await unsubscribeFromPush(true);

    assert.deepEqual(result, { ok: true });
    assert.equal(subscription.unsubscribeCalls, 1);
    assert.equal(fetchCalls.length, 1);
    assert.match(fetchCalls[0].url, /\/api\/push\/unsubscribe$/);
    assert.equal(fetchCalls[0].init?.method, 'DELETE');
    assert.equal(JSON.parse(fetchCalls[0].init?.body as string).endpoint, 'https://push.example.com/xyz');
  } finally {
    restore();
  }
});

test('unsubscribeFromPush skips the server DELETE entirely when apiAvailable is false, but still unsubscribes locally', async () => {
  const subscription = makeFakeSubscription();
  const { fetchCalls, restore } = installFakeBrowserGlobals({ subscription });
  try {
    const result = await unsubscribeFromPush(false);

    assert.deepEqual(result, { ok: true });
    assert.equal(subscription.unsubscribeCalls, 1);
    assert.equal(fetchCalls.length, 0);
  } finally {
    restore();
  }
});

test('unsubscribeFromPush stays ok even when the server DELETE fails — local state is already consistent', async () => {
  const subscription = makeFakeSubscription();
  const { fetchCalls, restore } = installFakeBrowserGlobals({
    subscription,
    fetchImpl: async () => {
      throw new Error('network down');
    },
  });
  try {
    const result = await unsubscribeFromPush(true);

    assert.deepEqual(result, { ok: true });
    assert.equal(subscription.unsubscribeCalls, 1, 'the browser-side unsubscribe must still have happened');
    assert.equal(fetchCalls.length, 1, 'the DELETE must still have been attempted');
  } finally {
    restore();
  }
});

test('unsubscribeFromPush is a no-op when there is no existing subscription', async () => {
  const { fetchCalls, restore } = installFakeBrowserGlobals({ subscription: null });
  try {
    const result = await unsubscribeFromPush(true);
    assert.deepEqual(result, { ok: true });
    assert.equal(fetchCalls.length, 0);
  } finally {
    restore();
  }
});

/**
 * design-refresh-v3 Faz 23 Commit 1 — native (Capacitor) mode serves assets
 * from disk, not through a service worker; registering one there is not
 * just useless but actively harmful (a stale SW could keep serving assets
 * from a previous Play Store version after an update). `isNative` mirrors
 * unsubscribeFromPush's existing `apiAvailable` pattern: the caller-known
 * fact is passed in explicitly rather than read from a global inside the
 * function, which is what makes this directly testable without needing to
 * fake Capacitor's own native-bridge detection (a module-load-time
 * singleton that can't be swapped after import).
 */
function installFakeServiceWorkerRegistry() {
  const registerCalls: string[] = [];
  const fakeRegistration = {
    waiting: null,
    addEventListener: () => {},
  };
  const originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', {
    value: {
      serviceWorker: {
        register: async (url: string) => {
          registerCalls.push(url);
          return fakeRegistration;
        },
        controller: null,
      },
    },
    configurable: true,
    writable: true,
  });
  return {
    registerCalls,
    restore: () => {
      if (originalNavigatorDescriptor) {
        Object.defineProperty(globalThis, 'navigator', originalNavigatorDescriptor);
      }
    },
  };
}

test('registerServiceWorker returns null and never calls navigator.serviceWorker.register in native mode', async () => {
  const { registerCalls, restore } = installFakeServiceWorkerRegistry();
  try {
    const result = await registerServiceWorker(undefined, true);
    assert.equal(result, null);
    assert.equal(registerCalls.length, 0);
  } finally {
    restore();
  }
});

test('registerServiceWorker registers the service worker as before when not native (web behavior unchanged)', async () => {
  const { registerCalls, restore } = installFakeServiceWorkerRegistry();
  try {
    const result = await registerServiceWorker(undefined, false);
    assert.ok(result);
    assert.deepEqual(registerCalls, ['/sw.js']);
  } finally {
    restore();
  }
});
