/**
 * PWA plumbing: service worker registration, install prompt support,
 * browser notifications, and the background-sync handshake.
 *
 * The app shell never depends on this module succeeding — every export is a
 * progressive enhancement on top of the plain static site.
 */

const SCOPE = './';

export function isStandalone() {
  try {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    );
  } catch {
    return false;
  }
}

export function isIos() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function supportsServiceWorker() {
  return 'serviceWorker' in navigator && window.isSecureContext;
}

/** Register sw.js and wire update + queue messages. Safe to call once. */
export async function registerServiceWorker() {
  if (!supportsServiceWorker()) return null;
  try {
    const reg = await navigator.serviceWorker.register('sw.js', { scope: SCOPE });
    if (navigator.serviceWorker.startMessages) navigator.serviceWorker.startMessages();

    document.documentElement.classList.add('sw-ready');

    if (reg.waiting && navigator.serviceWorker.controller) {
      document.dispatchEvent(new CustomEvent('pla:update-ready'));
    }

    reg.addEventListener('updatefound', () => {
      const worker = reg.installing;
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          document.dispatchEvent(new CustomEvent('pla:update-ready'));
        }
      });
    });

    navigator.serviceWorker.addEventListener('message', onWorkerMessage);
    return reg;
  } catch (err) {
    console.warn('[Puffy] Service worker registration failed:', err);
    return null;
  }
}

async function onWorkerMessage(event) {
  const data = event.data || {};
  if (data.type !== 'PLA_QUEUE_FLUSH') return;
  try {
    const { flushQueue } = await import('./api.js');
    const result = await flushQueue();
    console.debug(`[Puffy] Queue flushed on background sync · ${result.pending} change(s) waiting for a server.`);
  } catch (err) {
    console.debug('[Puffy] Queue flush skipped:', err && err.message);
  }
}

/* ------------------------------ Background sync -------------------------- */

export function requestBackgroundSync() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.ready
    .then((reg) => {
      if (reg.sync && reg.sync.register) return reg.sync.register('pla-sync');
      return null;
    })
    .catch(() => {
      /* Background Sync is a progressive enhancement */
    });
}

/** Listen for local writes and flush when the network comes back. */
export function watchQueue() {
  window.addEventListener('pla:queued', requestBackgroundSync);
  window.addEventListener('online', async () => {
    requestBackgroundSync();
    try {
      const { flushQueue } = await import('./api.js');
      await flushQueue();
    } catch {
      /* local only */
    }
  });
}

/* ------------------------------ Notifications ---------------------------- */

export function notificationSupport() {
  return 'Notification' in window ? Notification.permission : 'unsupported';
}

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

/**
 * Prefer the service worker so notifications survive a closed tab and respect
 * the shared notification channel. Falls back to the page constructor.
 */
export async function showNotification(title, { body = '', tag = 'puffy-nudge', link = './#/dashboard' } = {}) {
  if (notificationSupport() !== 'granted') return false;
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && typeof reg.showNotification === 'function') {
        await reg.showNotification(title, {
          body,
          tag,
          renotify: true,
          icon: 'assets/icons/icon-192.png',
          badge: 'assets/icons/icon-192.png',
          data: { link },
        });
        return true;
      }
    }
    new Notification(title, { body, tag });
    return true;
  } catch (err) {
    console.warn('[Puffy] Notification could not be shown:', err);
    return false;
  }
}

/* --------------------------------- Status -------------------------------- */

/** Ask the active worker what it has cached. Resolves null when unavailable. */
export async function getPwaStatus(timeout = 1500) {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const worker = navigator.serviceWorker.controller || (reg && reg.active);
    if (!worker) return null;
    return await new Promise((resolve) => {
      const channel = new MessageChannel();
      const timer = setTimeout(() => resolve(null), timeout);
      channel.port1.onmessage = (event) => {
        clearTimeout(timer);
        resolve(event.data || null);
      };
      worker.postMessage({ type: 'PLA_STATUS' }, [channel.port2]);
    });
  } catch {
    return null;
  }
}

/** Activate a waiting worker and reload once it takes control. */
export async function applyUpdate() {
  if (!('serviceWorker' in navigator)) return false;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg || !reg.waiting) return false;
  reg.waiting.postMessage({ type: 'SKIP_WAITING' });
  navigator.serviceWorker.addEventListener(
    'controllerchange',
    () => window.location.reload(),
    { once: true }
  );
  return true;
}
