/**
 * Phase 9 QA — PWA layer.
 * Verifies the manifest, icons, service worker, cached shell, offline
 * navigation/fallback, background sync handshake and notification plumbing.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const base = 'http://127.0.0.1:4173/';
const out = './shots';
fs.mkdirSync(out, { recursive: true });

const issues = [];
const notes = [];
const log = (...args) => {
  notes.push(args.join(' '));
  console.log(...args);
};
const fail = (msg) => {
  issues.push(msg);
  console.log('FAIL:', msg);
};

const browser = await chromium.launch({ channel: 'chromium' });
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  colorScheme: 'light',
});
await context.grantPermissions(['notifications']);

const page = await context.newPage();
const consoleErrors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));

/* ------------------------------ Seed + boot ------------------------------ */

await page.goto(`${base}#/welcome`, { waitUntil: 'networkidle' });
await page.locator('[data-demo]').click();
await page.waitForTimeout(800);
await page.goto(`${base}#/dashboard`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1400);

const swInfo = await page.evaluate(async () => {
  if (!('serviceWorker' in navigator)) return { supported: false };
  const reg = await navigator.serviceWorker.ready;
  for (let i = 0; i < 40 && !navigator.serviceWorker.controller; i += 1) {
    await new Promise((r) => setTimeout(r, 250));
  }
  return {
    supported: true,
    scope: reg.scope,
    active: reg.active ? reg.active.state : null,
    controller: Boolean(navigator.serviceWorker.controller),
    scriptURL: reg.active ? reg.active.scriptURL : '',
    syncSupported: Boolean(reg.sync),
    standaloneClass: document.documentElement.classList.contains('is-standalone'),
    secure: window.isSecureContext,
  };
});
log('service worker:', JSON.stringify(swInfo));
if (!swInfo.supported || !swInfo.controller) fail('service worker is not controlling the page');
if (!swInfo.syncSupported) fail('Background Sync API is not available');

/* -------------------------------- Manifest ------------------------------- */

const manifestRes = await page.request.get(`${base}manifest.webmanifest`);
if (manifestRes.status() !== 200) fail(`manifest status ${manifestRes.status()}`);
const manifest = await manifestRes.json();
const iconFiles = manifest.icons.map((i) => i.src);
const iconChecks = [];
for (const src of iconFiles) {
  const res = await page.request.get(base + src);
  const buf = await res.body();
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  iconChecks.push({ src, status: res.status(), width, height });
}
log('manifest icons:', JSON.stringify(iconChecks));
if (iconChecks.some((i) => i.status !== 200)) fail('a manifest icon is missing');
if (!iconChecks.some((i) => i.width === 192)) fail('no 192px icon');
if (!iconChecks.some((i) => i.width === 512)) fail('no 512px icon');
if (!manifest.icons.some((i) => (i.purpose || '').includes('maskable'))) fail('no maskable icon');
if (!manifest.screenshots || manifest.screenshots.length < 2) fail('manifest screenshots missing');
for (const shot of manifest.screenshots || []) {
  const res = await page.request.get(base + shot.src);
  if (res.status() !== 200) fail(`screenshot missing: ${shot.src}`);
}
if (!manifest.start_url || !manifest.name || !manifest.display) fail('manifest is missing install fields');
log(
  'manifest:',
  JSON.stringify({
    name: manifest.name,
    display: manifest.display,
    start_url: manifest.start_url,
    icons: manifest.icons.length,
    shortcuts: (manifest.shortcuts || []).length,
  })
);

const headTags = await page.evaluate(() => ({
  manifest: document.querySelector('link[rel="manifest"]')?.getAttribute('href'),
  appleIcon: document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href'),
  themeColor: document.querySelector('meta[name="theme-color"]')?.getAttribute('content'),
  mobileCapable: document.querySelector('meta[name="mobile-web-app-capable"]')?.getAttribute('content'),
}));
log('head tags:', JSON.stringify(headTags));
if (headTags.manifest !== 'manifest.webmanifest') fail('manifest link missing');
if (!headTags.appleIcon) fail('apple-touch-icon missing');

/* -------------------------------- Caches --------------------------------- */

const cacheInfo = await page.evaluate(async () => {
  const keys = await caches.keys();
  const shellName = keys.find((k) => k.startsWith('pip-shell'));
  const runtimeName = keys.find((k) => k.startsWith('pip-runtime'));
  const shell = shellName ? await caches.open(shellName) : null;
  const runtime = runtimeName ? await caches.open(runtimeName) : null;
  const urlList = shell ? (await shell.keys()).map((r) => new URL(r.url).pathname) : [];
  const chartURL = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js';
  return {
    keys,
    shellCount: urlList.length,
    hasIndex: urlList.some((u) => u.endsWith('/index.html')),
    hasApp: urlList.some((u) => u.endsWith('/assets/js/app.js')),
    hasAllPages: [
      'dashboard.js',
      'tasks.js',
      'planner.js',
      'bills.js',
      'money.js',
      'habits.js',
      'review.js',
      'notifications.js',
      'settings.js',
    ].every((p) => urlList.some((u) => u.endsWith(`/pages/${p}`))),
    hasFonts: urlList.some((u) => u.endsWith('.woff2')),
    chartCached: Boolean(runtime && (await runtime.match(chartURL))),
  };
});
log('caches:', JSON.stringify(cacheInfo));
if (!cacheInfo.shellCount || !cacheInfo.hasIndex) fail('app shell is not cached');
if (!cacheInfo.hasAllPages) fail('a page module is missing from the precache');
if (!cacheInfo.chartCached) fail('Chart.js is not cached by the service worker');

const swStatus = await page.evaluate(
  () =>
    new Promise((resolve) => {
      const sw = navigator.serviceWorker.controller;
      if (!sw) return resolve(null);
      const channel = new MessageChannel();
      const timer = setTimeout(() => resolve(null), 2000);
      channel.port1.onmessage = (event) => {
        clearTimeout(timer);
        resolve(event.data);
      };
      sw.postMessage({ type: 'PLA_STATUS' }, [channel.port2]);
    })
);
log('worker status:', JSON.stringify(swStatus));
if (!swStatus || !swStatus.version) fail('worker did not answer status request');

/* ------------------------- Background sync handshake --------------------- */

await page.evaluate(() => {
  window.__syncMessages = [];
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'PLA_QUEUE_FLUSH') window.__syncMessages.push(event.data);
  });
});

await page.goto(`${base}#/tasks`, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
const beforeQueue = await page.evaluate(
  () =>
    new Promise((resolve) => {
      const sw = navigator.serviceWorker.controller;
      const channel = new MessageChannel();
      const timer = setTimeout(() => resolve(null), 2000);
      channel.port1.onmessage = (e) => {
        clearTimeout(timer);
        resolve(e.data);
      };
      sw.postMessage({ type: 'PLA_STATUS' }, [channel.port2]);
    })
);
await page.locator('.task-check[data-check]').first().click();
await page.waitForTimeout(400);
const tagsResult = await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.ready;
  if (!reg.sync) return { tags: [], supported: false };
  try {
    return { tags: await reg.sync.getTags(), supported: true };
  } catch (err) {
    // Headless Chromium ships with background sync disabled as a platform feature.
    return { tags: [], supported: true, disabled: String(err.message || err) };
  }
});
await page.waitForTimeout(1200);
let syncMessages = await page.evaluate(() => window.__syncMessages || []);
if (!syncMessages.length) {
  await page.evaluate(() => {
    navigator.serviceWorker.controller?.postMessage({ type: 'PLA_SYNC_NOW' });
  });
  await page.waitForTimeout(700);
  syncMessages = await page.evaluate(() => window.__syncMessages || []);
}
const afterQueue = await page.evaluate(
  () =>
    new Promise((resolve) => {
      const sw = navigator.serviceWorker.controller;
      const channel = new MessageChannel();
      const timer = setTimeout(() => resolve(null), 2000);
      channel.port1.onmessage = (e) => {
        clearTimeout(timer);
        resolve(e.data);
      };
      sw.postMessage({ type: 'PLA_STATUS' }, [channel.port2]);
    })
);
log(
  'background sync:',
  JSON.stringify({
    pendingBefore: beforeQueue && beforeQueue.pending,
    pendingAfter: afterQueue && afterQueue.pending,
    tags: tagsResult.tags,
    disabled: tagsResult.disabled || null,
    messages: syncMessages,
  })
);
if (!afterQueue || afterQueue.pending <= (beforeQueue?.pending || 0)) {
  fail('a local mutation did not land in the sync queue');
}
if (!syncMessages.length && !tagsResult.tags.includes('pla-sync')) {
  fail('background sync was neither registered nor delivered');
}

/* ------------------------------ Notifications ---------------------------- */

await page.goto(`${base}#/notifications`, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
const permBefore = await page.evaluate(() => Notification.permission);
const toggle = page.locator('[data-notif-toggle]');
if ((await toggle.getAttribute('aria-label')) && !(await toggle.isChecked())) {
  await toggle.check();
  await page.waitForTimeout(600);
}
const profileNotif = await page.evaluate(async () => {
  const { getProfile } = await import('./assets/js/api.js');
  const p = await getProfile();
  return { notificationsOn: p.notificationsOn, permission: Notification.permission };
});
let testCount = null;
const testBtn = page.locator('[data-action="test"]');
if (await testBtn.isEnabled()) {
  await testBtn.click();
  await page.waitForTimeout(900);
  testCount = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    if (!reg.getNotifications) return -1;
    const list = await reg.getNotifications();
    return list.length;
  });
}
log('notifications:', JSON.stringify({ permBefore, profileNotif, testCount }));
if (profileNotif.permission !== 'granted') fail('notification permission was not granted');
if (!profileNotif.notificationsOn) fail('notification preference did not persist');
if (testCount !== null && testCount < 1) fail('test notification did not reach the notification centre');

// Put the preference back so screenshots show the default calm state.
if (await toggle.isChecked()) {
  await toggle.uncheck();
  await page.waitForTimeout(400);
}

/* -------------------------------- Offline -------------------------------- */

await page.goto(`${base}#/dashboard`, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(600);
await context.setOffline(true);
await page.reload({ waitUntil: 'load' }).catch(() => {});
await page.waitForTimeout(1400);

const offlineState = await page.evaluate(() => ({
  onLine: navigator.onLine,
  title: document.title,
  hasShell: Boolean(document.querySelector('.sidebar')),
  chipVisible: Boolean(document.querySelector('#offline-chip.is-visible')),
  chipText: document.querySelector('#offline-chip')?.textContent.trim(),
  heading: document.querySelector('#main h1, #main h2')?.textContent.trim(),
}));
log('offline reload:', JSON.stringify(offlineState));
if (!offlineState.hasShell) fail('the app shell did not load from cache offline');
if (!offlineState.chipVisible) fail('offline chip is not visible');

await page.screenshot({ path: path.join(out, 'phase9-offline-app.png') });

// Navigate to a lazily imported page without the network.
await page.evaluate(() => {
  window.location.hash = '#/tasks';
});
await page.waitForTimeout(1000);
const offlineTasks = await page.evaluate(() => ({
  route: window.location.hash,
  rows: document.querySelectorAll('.task-row').length,
  heading: document.querySelector('#main h1, #main h2')?.textContent.trim(),
}));
log('offline tasks:', JSON.stringify(offlineTasks));
if (!offlineTasks.rows) fail('a lazy page module did not load offline');

await page.goto(`${base}offline.html`, { waitUntil: 'domcontentloaded' }).catch(() => {});
await page.waitForTimeout(500);
const offlinePage = await page.evaluate(() => ({
  title: document.title,
  heading: document.querySelector('h1')?.textContent.replace(/\s+/g, ' ').trim(),
  hasActions: document.querySelectorAll('.actions .btn').length,
}));
log('offline page:', JSON.stringify(offlinePage));
if (!offlinePage.heading || !offlinePage.heading.includes('Pip is still here')) {
  fail('offline fallback page was not served from cache');
}
await page.screenshot({ path: path.join(out, 'phase9-offline-desktop.png') });

await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(out, 'phase9-offline-phone.png') });

await context.setOffline(false);
await page.setViewportSize({ width: 1280, height: 900 });
await page.goto(`${base}#/settings`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1600);

/* ------------------------------ Settings proof --------------------------- */

const swStatusText = await page.locator('[data-sw-status]').textContent();
log('settings sw status:', JSON.stringify(swStatusText.trim()));
if (!/Offline shell ready/.test(swStatusText)) fail('settings does not show the offline shell status');

await page.screenshot({ path: path.join(out, 'phase9-settings-desktop.png'), fullPage: false });
await page.locator('[data-install-card]').screenshot({ path: path.join(out, 'phase9-install-card.png') });

for (const [label, viewport] of [
  ['phone', { width: 360, height: 800 }],
  ['tablet', { width: 768, height: 1024 }],
]) {
  for (const theme of ['light', 'dark']) {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ colorScheme: theme });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(900);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    if (overflow > 0) fail(`${label}/${theme} horizontal overflow ${overflow}px`);
    await page.screenshot({ path: path.join(out, `phase9-settings-${label}-${theme}.png`) });
  }
}

/* ------------------------------ Console + exit --------------------------- */

await page.setViewportSize({ width: 1280, height: 900 });
await page.emulateMedia({ colorScheme: 'light' });
await page.goto(`${base}#/dashboard`, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(out, 'phase9-dashboard-desktop.png') });

const relevantErrors = consoleErrors;
log('console errors:', JSON.stringify(consoleErrors));
if (relevantErrors.length) fail(`console errors: ${relevantErrors.join(' | ')}`);

fs.writeFileSync(
  path.join(out, 'phase9-notes.txt'),
  `${notes.join('\n')}\n\n` + (issues.length ? `ISSUES:\n${issues.join('\n')}` : 'CLEAN: all PWA checks passed.')
);

await browser.close();

if (issues.length) {
  console.log(`\n${issues.length} issue(s):\n- ${issues.join('\n- ')}`);
  process.exit(1);
}
console.log('\nCLEAN: manifest, service worker, cache, offline, sync and notifications verified.');
