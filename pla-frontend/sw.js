/**
 * Puffy service worker — offline shell, cached Chart.js, background sync.
 *
 * Cache strategy:
 *   navigations  network-first (3.5s) → cached index.html → offline.html
 *   app assets   stale-while-revalidate
 *   fonts/icons  cache-first
 *   Chart.js     cache-first from the pinned CDN URL
 *
 * Bump VERSION whenever precached files change.
 */
const VERSION = 'puffy-v1.1.0';
const SHELL = `puffy-shell-${VERSION}`;
const RUNTIME = `puffy-runtime-${VERSION}`;
const CHART_URL = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js';
const SYNC_TAG = 'pla-sync';

const PRECACHE = [
  './',
  'index.html',
  'offline.html',
  'manifest.webmanifest',
  'assets/css/app.css',
  'assets/js/app.js',
  'assets/js/api.js',
  'assets/js/analytics.js',
  'assets/js/constants.js',
  'assets/js/icons.js',
  'assets/js/illustrations.js',
  'assets/js/mascot.js',
  'assets/js/planner.js',
  'assets/js/pwa.js',
  'assets/js/router.js',
  'assets/js/store.js',
  'assets/js/theme.js',
  'assets/js/pages/welcome.js',
  'assets/js/pages/dashboard.js',
  'assets/js/pages/tasks.js',
  'assets/js/pages/planner.js',
  'assets/js/pages/bills.js',
  'assets/js/pages/money.js',
  'assets/js/pages/habits.js',
  'assets/js/pages/review.js',
  'assets/js/pages/notifications.js',
  'assets/js/pages/settings.js',
  'assets/js/ui/charts.js',
  'assets/js/ui/csv.js',
  'assets/js/ui/format.js',
  'assets/js/ui/sheet.js',
  'assets/js/ui/toast.js',
  'assets/js/ui/widgets.js',
  'assets/fonts/fraunces-latin.woff2',
  'assets/fonts/instrument-sans-latin.woff2',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/icon-maskable-192.png',
  'assets/icons/icon-maskable-512.png',
  'assets/icons/apple-touch-icon.png',
  'assets/screenshots/dashboard-desktop.png',
  'assets/screenshots/dashboard-phone.png',
  'seed/demo-data.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL);
      // addAll is atomic; add() one by one keeps a single 404 from killing install.
      await Promise.all(
        PRECACHE.map((url) =>
          cache.add(new Request(url, { cache: 'reload' })).catch(() => null)
        )
      );
      // Chart.js is optional at install time — never block the worker on a CDN.
      try {
        const runtime = await caches.open(RUNTIME);
        const res = await fetch(new Request(CHART_URL, { mode: 'cors', cache: 'reload' }));
        if (res.ok) await runtime.put(CHART_URL, res.clone());
      } catch {
        /* offline during install; Chart.js will be cached on first use */
      }
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => (key.startsWith('puffy-') || key.startsWith('pip-')) && key !== SHELL && key !== RUNTIME)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

function isChart(url) {
  return url.href === CHART_URL || url.pathname.includes('/chart.js@4.4.7/');
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res && (res.ok || res.type === 'opaque')) await cache.put(request, res.clone());
  return res;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(SHELL);
  const hit = await cache.match(request);
  const update = fetch(request)
    .then((res) => {
      if (res && res.ok) cache.put(request, res.clone());
      return res;
    })
    .catch(() => null);
  return hit || update || Response.error();
}

async function navigationResponse(request) {
  const cache = await caches.open(SHELL);
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(request, { signal: controller.signal });
    clearTimeout(timer);
    if (res && res.ok) return res;
    throw new Error('Bad navigation response');
  } catch {
    return (
      (await cache.match(request, { ignoreSearch: true })) ||
      (await cache.match('index.html')) ||
      (await cache.match('./')) ||
      (await cache.match('offline.html')) ||
      Response.error()
    );
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  if (request.mode === 'navigate') {
    event.respondWith(navigationResponse(request));
    return;
  }

  if (isChart(url)) {
    event.respondWith(
      cacheFirst(request, RUNTIME).catch(async () => {
        const shell = await caches.open(SHELL);
        return shell.match(request);
      })
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  if (/\.(woff2?|png|jpe?g|svg|webp|ico)$/i.test(url.pathname)) {
    event.respondWith(cacheFirst(request, SHELL));
    return;
  }

  if (/\.(css|js|mjs|json|webmanifest)$/i.test(url.pathname) || url.pathname.endsWith('/')) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

/* --------------------------- Background sync ----------------------------- */

function queueCount() {
  return new Promise((resolve) => {
    let settled = false;
    const done = (value) => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };
    let req;
    try {
      req = indexedDB.open('puffy-life-admin');
    } catch {
      done(0);
      return;
    }
    req.onupgradeneeded = () => {
      // No queue exists yet — there is nothing to replay.
      try {
        req.transaction.abort();
      } catch {
        /* ignore */
      }
      done(0);
    };
    req.onerror = () => done(0);
    req.onsuccess = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('syncQueue')) {
        db.close();
        done(0);
        return;
      }
      try {
        const count = db.transaction('syncQueue', 'readonly').objectStore('syncQueue').count();
        count.onsuccess = () => {
          db.close();
          done(count.result || 0);
        };
        count.onerror = () => {
          db.close();
          done(0);
        };
      } catch {
        db.close();
        done(0);
      }
    };
  });
}

async function replayQueue() {
  const pending = await queueCount();
  // A real backend replays POST /api/sync here, then clears acknowledged rows.
  // Until then, ask any open window to flush the local queue and stay honest.
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  clients.forEach((client) => client.postMessage({ type: 'PLA_QUEUE_FLUSH', pending }));
  return pending;
}

self.addEventListener('sync', (event) => {
  if (event.tag !== SYNC_TAG) return;
  event.waitUntil(replayQueue());
});

/* ---------------------------- Notifications ------------------------------ */

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  if (data.type === 'PLA_SYNC_NOW') {
    event.waitUntil(replayQueue());
    return;
  }

  if (data.type === 'PLA_NOTIFY') {
    event.waitUntil(
      self.registration.showNotification(data.title || 'Puffy', {
        body: data.body || '',
        icon: 'assets/icons/icon-192.png',
        badge: 'assets/icons/icon-192.png',
        tag: data.tag || 'puffy-nudge',
        renotify: true,
        data: { link: data.link || './#/dashboard' },
      })
    );
    return;
  }

  if (data.type === 'PLA_STATUS' && event.ports && event.ports[0]) {
    event.waitUntil(
      (async () => {
        const pending = await queueCount();
        const keys = await caches.keys();
        event.ports[0].postMessage({
          version: VERSION,
          pending,
          caches: keys.filter((key) => (key.startsWith('puffy-') || key.startsWith('pip-'))),
          chartCached: Boolean(await (await caches.open(RUNTIME)).match(CHART_URL)),
        });
      })()
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || './#/dashboard';
  event.waitUntil(
    (async () => {
      const target = new URL(link, self.registration.scope);
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of windows) {
        if (new URL(client.url).origin === target.origin) {
          await client.focus();
          if ('navigate' in client) await client.navigate(target.href).catch(() => {});
          return;
        }
      }
      await self.clients.openWindow(target.href);
    })()
  );
});
