/**
 * Tiny hash router. Each page module default-exports render(root, ctx),
 * optionally returning { destroy } for cleanup (charts, timers, listeners).
 */

export const ROUTES = {
  welcome: {
    id: 'welcome',
    title: 'Welcome',
    chrome: 'bare',
    load: () => import('./pages/welcome.js'),
  },
  dashboard: {
    id: 'dashboard',
    title: 'Today',
    load: () => import('./pages/dashboard.js'),
  },
  tasks: {
    id: 'tasks',
    title: 'Tasks',
    load: () => import('./pages/tasks.js'),
  },
  planner: {
    id: 'planner',
    title: 'Daily planner',
    load: () => import('./pages/planner.js'),
  },
  bills: {
    id: 'bills',
    title: 'Bills',
    load: () => import('./pages/bills.js'),
  },
  money: {
    id: 'money',
    title: 'Expenses & budgets',
    load: () => import('./pages/money.js'),
  },
  habits: {
    id: 'habits',
    title: 'Habits & goals',
    load: () => import('./pages/habits.js'),
  },
  review: {
    id: 'review',
    title: 'Weekly review',
    load: () => import('./pages/review.js'),
  },
  notifications: {
    id: 'notifications',
    title: 'Notifications',
    load: () => import('./pages/notifications.js'),
  },
  settings: {
    id: 'settings',
    title: 'Settings',
    load: () => import('./pages/settings.js'),
  },
};

export function parseHash() {
  const raw = window.location.hash.replace(/^#\/?/, '');
  const [pathPart, queryPart] = raw.split('?');
  const path = (pathPart || '').replace(/\/+$/, '');
  return { path, query: new URLSearchParams(queryPart || '') };
}

export function navigate(path, { replace = false } = {}) {
  const target = `#/${path}`;
  if (window.location.hash === target) return;
  if (replace) {
    history.replaceState(null, '', target);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    window.location.hash = target;
  }
}

export function startRouter({ content, ctx, onRoute, fallback = 'dashboard', guard }) {
  let cleanup = null;
  let renderToken = 0;

  async function render() {
    const token = ++renderToken;
    const { path, query } = parseHash();
    const route = ROUTES[path] || ROUTES[fallback];

    if (guard && !guard(route, path)) {
      navigate('welcome', { replace: true });
      return;
    }

    document.documentElement.dataset.route = route.id;
    document.documentElement.dataset.chrome = route.chrome || 'app';
    document.title = `${route.title} · Puffy`;
    onRoute?.(route, path);

    try {
      cleanup?.();
    } catch {
      /* a broken cleanup should never block navigation */
    }
    cleanup = null;

    /* Each render gets its own host element. If a slower page finishes after
       the user has already navigated away, its writes land in the detached
       host instead of repainting the new page. */
    const host = document.createElement('div');
    host.className = 'route-host';
    content.replaceChildren(host);
    content.setAttribute('aria-busy', 'true');

    try {
      const mod = await route.load();
      if (token !== renderToken) return;
      const result = await mod.default(host, { ...ctx, query, route });
      if (token !== renderToken) {
        result?.destroy?.();
        return;
      }
      cleanup = typeof result?.destroy === 'function' ? result.destroy : null;
      content.setAttribute('aria-busy', 'false');
      content.focus({ preventScroll: true });
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' in document.documentElement.style ? 'instant' : 'auto' });
    } catch (err) {
      console.error(err);
      content.innerHTML = `<div class="card" style="margin-top:24px">
        <h2>That page didn’t load.</h2>
        <p class="muted" style="margin:8px 0 16px">Try again — everything is stored on this device, so nothing was lost.</p>
        <button class="btn btn--primary" type="button" onclick="location.reload()">Reload the page</button>
      </div>`;
    }
  }

  window.addEventListener('hashchange', render);
  render();

  return {
    refresh: render,
    destroy() {
      window.removeEventListener('hashchange', render);
      cleanup?.();
    },
  };
}
