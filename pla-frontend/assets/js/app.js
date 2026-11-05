import { icon } from './icons.js';
import { applyMascotStyle, applyMascotForm, puffy as pip, puffyGlyph as pipGlyph, puffyStamp as pipStamp, puffy, puffyGlyph, puffyStamp } from './mascot.js';
import {
  initTheme,
  applyAccent,
  cycleTheme,
  getAccent,
  getThemePref,
  onThemeChange,
} from './theme.js';
import { startRouter, navigate } from './router.js';
import { registerServiceWorker, watchQueue, isStandalone } from './pwa.js';
import { formatDate, todayISO, initials } from './ui/format.js';
import { openSheet, confirmSheet } from './ui/sheet.js';
import { toast } from './ui/toast.js';
import {
  initApi,
  getProfile,
  saveProfile,
  completeOnboarding,
  getUnreadCount,
} from './api.js';

const DEMO_PROFILE = {
  id: 'me',
  name: 'Maya Chen',
  email: 'maya.chen@example.com',
  accent: 'terracotta',
  mascotStyle: 'slate',
  mascotForm: 'lantern',
  avatarStyle: 'initials',
  workStart: '09:00',
  workEnd: '17:30',
  aiOn: true,
  notificationsOn: false,
  onboarded: false,
};

const NAV_GROUPS = [
  {
    label: 'Daily',
    items: [
      { route: 'dashboard', label: 'Today', icon: 'home' },
      { route: 'tasks', label: 'Tasks', icon: 'tasks' },
      { route: 'planner', label: 'Daily planner', icon: 'calendar' },
    ],
  },
  {
    label: 'Money',
    items: [
      { route: 'bills', label: 'Bills', icon: 'receipt' },
      { route: 'money', label: 'Expenses & budgets', icon: 'chart' },
    ],
  },
  {
    label: 'Growth',
    items: [
      { route: 'habits', label: 'Habits & goals', icon: 'sprout' },
      { route: 'review', label: 'Weekly review', icon: 'book' },
    ],
  },
  {
    label: 'System',
    items: [
      { route: 'notifications', label: 'Notifications', icon: 'bell' },
      { route: 'settings', label: 'Settings', icon: 'settings' },
    ],
  },
];

const TABS = [
  { key: 'dashboard', route: 'dashboard', label: 'Today', icon: 'home' },
  { key: 'tasks', route: 'tasks', label: 'Tasks', icon: 'tasks' },
  { key: 'planner', route: 'planner', label: 'Plan', icon: 'calendar' },
  { key: 'money', route: 'money', label: 'Money', icon: 'chart' },
  { key: 'more', route: null, label: 'More', icon: 'more' },
];

const TAB_FOR_ROUTE = {
  dashboard: 'dashboard',
  tasks: 'tasks',
  planner: 'planner',
  money: 'money',
  bills: 'money',
  habits: 'more',
  review: 'more',
  notifications: 'more',
  settings: 'more',
};

const MORE_LINKS = [
  { route: 'bills', icon: 'receipt', label: 'Bills', sub: 'Rent, utilities, subscriptions' },
  { route: 'habits', icon: 'sprout', label: 'Habits & goals', sub: 'Streaks and the longer view' },
  { route: 'review', icon: 'book', label: 'Weekly review', sub: 'A short look back, then forward' },
  { route: 'notifications', icon: 'bell', label: 'Notifications', sub: 'Reminders and quiet alerts' },
  { route: 'settings', icon: 'settings', label: 'Settings', sub: 'Profile, theme, data' },
];

let profile = { ...DEMO_PROFILE };

function navGroupsMarkup() {
  return NAV_GROUPS.map(
    (group) => `
    <div class="nav-group">
      <span class="nav-group__label">${group.label}</span>
      ${group.items
        .map(
          (item) => `<a class="nav-item" href="#/${item.route}" data-route="${item.route}">
            ${icon(item.icon, 19)}
            <span>${item.label}</span>
            ${item.route === 'notifications' ? '<span class="nav-item__count" data-nav-count="notifications" data-zero="true">0</span>' : ''}
          </a>`
        )
        .join('')}
    </div>`
  ).join('');
}

function shellMarkup() {
  return `
  <aside class="sidebar" aria-label="Primary sidebar">
    <div class="sidebar__top">
      <a class="brand" href="#/dashboard">
        <span class="brand__mark" data-glyph-size="23">${pipGlyph(23)}</span>
        <span>
          <span class="brand__word">Puffy</span>
          <span class="brand__sub">Life admin</span>
        </span>
      </a>
    </div>
    <div class="sidebar__scroll">
      <nav aria-label="Main navigation">${navGroupsMarkup()}</nav>
    </div>
    <div class="sidebar__foot">
      <div class="side-card">
        ${pipStamp(40, 'happy')}
        <span class="side-card__text">
          <span class="side-card__kicker">A quiet place</span>
          <span class="side-card__title">for loud weeks.</span>
        </span>
      </div>
      <a class="profile-chip" href="#/settings" aria-label="Profile and settings">
        <span class="avatar" data-avatar aria-hidden="true">${initials(profile.name)}</span>
        <span class="profile-chip__meta">
          <span class="profile-chip__name" data-profile-name>${profile.name}</span>
          <span class="profile-chip__sub">Personal plan</span>
        </span>
        ${icon('chevron-right', 15)}
      </a>
      <button class="logout-btn" type="button" data-logout>
        ${icon('logout', 15)}
        <span>Log out</span>
      </button>
    </div>
  </aside>

  <div class="app__main">
    <header class="topbar">
      <a class="mobile-brand" href="#/dashboard" aria-label="Puffy home">
        <span class="brand__mark" data-glyph-size="18">${pipGlyph(18)}</span>
        <span>Puffy</span>
      </a>
      <div class="topbar__date">
        ${icon('calendar', 15)}
        <span>${formatDate(todayISO(), 'weekday-long')}</span>
        <strong>· ${formatDate(todayISO(), 'short')}</strong>
      </div>
      <span class="offline-chip" id="offline-chip" role="status">${icon('wifi-off', 13)} Offline — saved here</span>
      <div class="topbar__spacer"></div>
      <div class="topbar__actions">
        <button class="icon-btn" type="button" data-theme-toggle aria-label="Change theme" title="Change theme">
          ${icon('auto', 19)}
        </button>
        <a class="icon-btn" href="#/notifications" aria-label="Notifications" title="Notifications" style="position:relative">
          ${icon('bell', 19)}
          <span class="tab__dot hidden" data-notif-dot aria-hidden="true"></span>
        </a>
        <span class="topbar__divider" aria-hidden="true"></span>
        <a class="icon-btn" href="#/settings" aria-label="Profile and settings" title="Profile">
          <span class="avatar avatar--sm" data-avatar aria-hidden="true">${initials(profile.name)}</span>
        </a>
      </div>
    </header>

    <main id="main" class="content" tabindex="-1"></main>
  </div>

  <nav class="tabbar" aria-label="Primary tabs">
    ${TABS.map(
      (tab) =>
        tab.route
          ? `<a class="tab" href="#/${tab.route}" data-tab="${tab.key}" ${tab.key === 'dashboard' ? 'aria-current="page"' : ''}>
              <span class="tab__icon">${icon(tab.icon, 21)}</span>
              <span>${tab.label}</span>
            </a>`
          : `<button class="tab" type="button" data-tab="more" aria-haspopup="dialog">
              <span class="tab__icon">${icon(tab.icon, 21)}</span>
              <span>${tab.label}</span>
            </button>`
    ).join('')}
  </nav>

  <div class="toast-region" role="status" aria-live="polite"></div>
  `;
}

function paintProfile() {
  document.querySelectorAll('[data-profile-name]').forEach((el) => (el.textContent = profile.name));
  const usePip = profile.avatarStyle === 'pip' || profile.avatarStyle === 'puffy';
  document.querySelectorAll('[data-avatar]').forEach((el) => {
    el.classList.toggle('avatar--pip', usePip);
    el.classList.toggle('avatar--puffy', usePip);
    el.innerHTML = usePip ? pipGlyph(18) : initials(profile.name);
    el.title = usePip ? 'Puffy' : profile.name;
  });
}

function paintThemeButton() {
  const btn = document.querySelector('[data-theme-toggle]');
  if (!btn) return;
  const pref = getThemePref();
  btn.innerHTML = icon(pref === 'auto' ? 'auto' : pref === 'dark' ? 'moon' : 'sun', 19);
  btn.setAttribute('aria-label', `Theme: ${pref}. Change theme`);
  btn.title = `Theme: ${pref}${pref === 'auto' ? ' (follows system)' : ''}`;
  btn.setAttribute('data-pref', pref);
}

function paintOnline() {
  const chip = document.getElementById('offline-chip');
  if (chip) chip.classList.toggle('is-visible', !navigator.onLine);
}

function openMore() {
  const sheet = openSheet({
    eyebrow: 'Everything else',
    title: 'A few more places',
    subtitle: 'Bills, growing things, and the small print of your week.',
    body: `
      <div class="more-grid">
        ${MORE_LINKS.map(
          (link) => `<a class="more-link" href="#/${link.route}">
            <span class="more-link__icon">${icon(link.icon, 19)}</span>
            <span class="more-link__text">
              <strong>${link.label}</strong>
              <small>${link.sub}</small>
            </span>
            ${icon('chevron-right', 15)}
          </a>`
        ).join('')}
      </div>
      <div class="more-note">
        ${pipStamp(34, 'sleepy')}
        <p class="tiny muted">Your data lives on this device only. No account, no cloud, no peeking.</p>
      </div>
    `,
    footer: `<button class="btn btn--ghost btn--block" type="button" data-logout-more>
      ${icon('logout', 15)} Log out
    </button>`,
  });
  sheet.body.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => sheet.close()));
  sheet.footer?.querySelector('[data-logout-more]')?.addEventListener('click', () => {
    sheet.close();
    logOut();
  });
}

function markNavigation(route, path) {
  document.querySelectorAll('.nav-item[data-route]').forEach((el) => {
    const active = el.dataset.route === route.id;
    if (active) el.setAttribute('aria-current', 'page');
    else el.removeAttribute('aria-current');
  });
  const activeTab = TAB_FOR_ROUTE[route.id] || TAB_FOR_ROUTE[path];
  document.querySelectorAll('.tab[data-tab]').forEach((el) => {
    if (el.dataset.tab === activeTab) el.setAttribute('aria-current', 'page');
    else el.removeAttribute('aria-current');
  });
}

async function refreshBadges() {
  try {
    const unread = await getUnreadCount();
    document.querySelectorAll('[data-notif-dot]').forEach((el) => el.classList.toggle('hidden', unread === 0));
    const badge = document.querySelector('[data-nav-count="notifications"]');
    if (badge) {
      badge.textContent = unread;
      badge.dataset.zero = unread === 0 ? 'true' : 'false';
    }
  } catch {
    /* badges are a nicety, never a blocker */
  }
}

function paintShellMascots() {
  document.querySelectorAll('.brand__mark[data-glyph-size]').forEach((el) => {
    el.innerHTML = pipGlyph(Number(el.dataset.glyphSize) || 22);
  });
  document.querySelectorAll('[data-puffy-stamp], [data-pip-stamp]').forEach((el) => {
    const mood = el.dataset.puffyStamp || el.dataset.pipStamp || 'happy';
    const size = parseFloat(el.style.getPropertyValue('--stamp')) || 40;
    el.innerHTML = puffy({ mood, size: Math.round(size * 0.92) });
  });
}

function refreshShell() {
  applyAccent(profile.accent || getAccent());
  applyMascotStyle(profile.mascotStyle);
  applyMascotForm(profile.mascotForm);
  paintShellMascots();
  paintProfile();
  paintThemeButton();
  refreshBadges();
}

async function logOut() {
  const ok = await confirmSheet({
    title: 'Log out of Puffy?',
    message:
      'Your desk — tasks, bills, budgets, habits and settings — stays on this device. You can open it again from the welcome screen.',
    confirmLabel: 'Log out',
    cancelLabel: 'Stay logged in',
    tone: 'primary',
  });
  if (!ok) return;

  try {
    const next = await saveProfile({ onboarded: false });
    profile = { ...profile, ...next };
    refreshShell();
    toast('Logged out. Your desk is waiting here.');
    navigate('welcome', { replace: true });
  } catch (err) {
    console.warn('Could not log out', err);
    toast('Could not log out. Local storage may be blocked.', { type: 'error' });
  }
}

async function boot() {
  initTheme();
  watchQueue();
  document.documentElement.classList.toggle('is-standalone', isStandalone());

  try {
    const stored = await initApi();
    if (stored) profile = { ...DEMO_PROFILE, ...stored };
    applyAccent(profile.accent || getAccent());
    applyMascotStyle(profile.mascotStyle);
    applyMascotForm(profile.mascotForm);
  } catch (err) {
    // Private windows can block IndexedDB. The shell still renders so the
    // message can explain what happened rather than showing a blank page.
    console.warn('Local database unavailable:', err);
    toast('Local storage is blocked in this browser. Data cannot be saved.', { type: 'error', duration: 6000 });
  }

  document.getElementById('app').innerHTML = shellMarkup();

  const themeBtn = document.querySelector('[data-theme-toggle]');
  themeBtn.addEventListener('click', () => {
    cycleTheme();
    paintThemeButton();
    profile = { ...profile, theme: getThemePref() };
    saveProfile({ theme: getThemePref() }).catch(() => {});
  });

  document.querySelector('[data-tab="more"]')?.addEventListener('click', openMore);
  document.querySelector('[data-logout]')?.addEventListener('click', logOut);

  paintThemeButton();
  paintOnline();
  refreshBadges();
  window.addEventListener('online', paintOnline);
  window.addEventListener('offline', paintOnline);

  onThemeChange(() => paintThemeButton());

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    window.__plaInstallPrompt = e;
    document.dispatchEvent(new CustomEvent('pla:installable'));
  });
  window.addEventListener('appinstalled', () => {
    window.__plaInstallPrompt = null;
    toast('Puffy is installed. It works offline now.', { type: 'success' });
  });

  const ctx = {
    navigate,
    toast,
    openSheet,
    getProfile: () => profile,
    async updateProfile(patch) {
      const next = await saveProfile(patch);
      profile = { ...profile, ...next };
      refreshShell();
      return profile;
    },
    async finishOnboarding(patch = {}) {
      const next = await completeOnboarding(patch);
      profile = { ...profile, ...next };
      refreshShell();
      return profile;
    },
    async reloadProfile() {
      const next = await getProfile();
      if (next) profile = { ...DEMO_PROFILE, ...next };
      refreshShell();
      return profile;
    },
    refreshShell,
    refreshBadges,
  };

  if (!profile.onboarded) {
    if (window.location.hash !== '#/welcome') history.replaceState(null, '', '#/welcome');
  } else if (!window.location.hash) {
    history.replaceState(null, '', '#/dashboard');
  }

  startRouter({
    content: document.getElementById('main'),
    ctx,
    onRoute: markNavigation,
    fallback: 'dashboard',
    guard: (route) => route.id === 'welcome' || profile.onboarded,
  });

  document.documentElement.classList.add('is-ready');

  // Register after first load so precaching never competes with the first paint.
  const startPwa = () => {
    registerServiceWorker().then((reg) => {
      if (reg) document.documentElement.classList.add('sw-ready');
    });
  };
  if (document.readyState === 'complete') startPwa();
  else window.addEventListener('load', startPwa, { once: true });

  document.addEventListener('pla:update-ready', () => {
    toast('A new Puffy is ready. Reload when you have a moment.', { type: 'info', duration: 7000 });
  });
}

boot();
