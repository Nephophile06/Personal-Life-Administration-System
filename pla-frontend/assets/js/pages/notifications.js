import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  generateReminders,
} from '../api.js';
import { addDays, esc, isoDate, relativeTime, todayISO } from '../ui/format.js';
import { emptyState, pageHead } from '../ui/widgets.js';
import { icon } from '../icons.js';
import { emptyNotifications } from '../illustrations.js';
import { toast, toastError } from '../ui/toast.js';
import { pip } from '../mascot.js';
import {
  notificationSupport,
  requestNotificationPermission,
  showNotification,
} from '../pwa.js';

const TYPE_META = {
  bill: { icon: 'receipt', tone: 'ochre', label: 'Bill' },
  task: { icon: 'tasks', tone: 'accent', label: 'Task' },
  budget: { icon: 'chart', tone: 'rose', label: 'Budget' },
  system: { icon: 'sparkles', tone: 'sage', label: 'Puffy' },
  habit: { icon: 'flame', tone: 'ochre', label: 'Habit' },
};

const metaFor = (type) => TYPE_META[type] || TYPE_META.system;

const dateOf = (ts) => {
  try {
    return isoDate(new Date(ts));
  } catch {
    return todayISO();
  }
};

export default async function notificationsPage(root, ctx) {
  const today = todayISO();
  let profile = ctx.getProfile();
  let state = {
    items: [],
    filter: 'all',
  };
  let generation = 0;

  root.innerHTML = `<div class="page notif-page">
    <div class="page-loading" aria-busy="true">
      <div class="skeleton page-loading__head"></div>
      <div class="skeleton page-loading__row"></div>
      <div class="skeleton page-loading__row"></div>
      <div class="skeleton page-loading__row"></div>
      <span class="sr-only">Loading your notifications</span>
    </div>
  </div>`;

  try {
    state.items = await getNotifications();
  } catch (err) {
    console.error(err);
    root.innerHTML = `<div class="page"><div class="card card--pad-lg">
      <span class="eyebrow">A gentle tap</span>
      <h2 style="margin:10px 0 8px">The nudges didn’t load.</h2>
      <p class="muted small">The local database could not be read. Nothing has been lost — try reloading this page.</p>
      <button class="btn btn--primary" type="button" style="margin-top:16px" data-retry>Reload the page</button>
    </div></div>`;
    root.querySelector('[data-retry]')?.addEventListener('click', () => window.location.reload());
    return {};
  }

  const unreadCount = () => state.items.filter((n) => !n.read).length;
  const findItem = (id) => state.items.find((n) => n.id === id);

  function groups() {
    const now = todayISO();
    const weekStart = addDays(now, -6);
    const visible = state.items.filter((n) => state.filter === 'all' || !n.read);
    const bucket = { today: [], week: [], earlier: [] };
    visible.forEach((n) => {
      const day = dateOf(n.ts);
      if (day === now) bucket.today.push(n);
      else if (day >= weekStart) bucket.week.push(n);
      else bucket.earlier.push(n);
    });
    return [
      { id: 'today', title: 'Today', items: bucket.today },
      { id: 'week', title: 'This week', items: bucket.week },
      { id: 'earlier', title: 'Earlier', items: bucket.earlier },
    ].filter((g) => g.items.length);
  }

  function row(n) {
    const meta = metaFor(n.type);
    const link = n.link || '';
    return `<li class="notif-row${n.read ? ' is-read' : ''}" data-id="${n.id}" data-type="${n.type || 'system'}">
      <button class="notif-open" type="button" data-action="open">
        <span class="notif-icon tone tone--${meta.tone}" aria-hidden="true">${icon(meta.icon, 18)}</span>
        <span class="notif-body">
          <span class="notif-title">${esc(n.title)}${n.read ? '' : '<span class="sr-only"> (unread)</span>'}</span>
          ${n.body ? `<span class="notif-text">${esc(n.body)}</span>` : ''}
          <span class="notif-meta">${meta.label} · ${relativeTime(n.ts)}</span>
        </span>
        ${link ? `<span class="notif-go" aria-hidden="true">${icon('chevron-right', 16)}</span>` : ''}
      </button>
      <details class="row-menu">
        <summary class="icon-btn" aria-label="More options for ${esc(n.title)}">${icon('more', 17)}</summary>
        <div class="menu menu--right">
          <button type="button" data-action="toggle-read">${icon('eye', 15)} Mark as ${n.read ? 'unread' : 'read'}</button>
          <button type="button" class="menu__danger" data-action="delete">${icon('trash', 15)} Delete</button>
        </div>
      </details>
      ${n.read ? '' : '<span class="notif-unread-bar" aria-hidden="true"></span>'}
    </li>`;
  }

  function list() {
    const sections = groups();
    if (!sections.length) {
      return state.filter === 'unread'
        ? emptyState({
            illustration: emptyNotifications(),
            title: 'All caught up.',
            text: 'Nothing unread. The list can wait until something real needs your attention.',
            action: `<button class="btn btn--secondary" type="button" data-filter-reset>Show everything</button>`,
          })
        : emptyState({
            illustration: emptyNotifications(),
            title: 'No nudges yet.',
            text: 'Puffy only speaks up when a date gets close or something slips. Quiet means quiet.',
            action: `<button class="btn btn--secondary" type="button" data-action="check">${icon('refresh', 15)} Check for reminders</button>`,
          });
    }
    return sections
      .map(
        (section) => `<section class="notif-group" aria-labelledby="notif-${section.id}">
          <div class="notif-group__head">
            <h2 id="notif-${section.id}">${section.title} <span class="seg-count">${section.items.length}</span></h2>
          </div>
          <ul class="notif-list">${section.items.map(row).join('')}</ul>
        </section>`
      )
      .join('');
  }

  function toolbar() {
    return `<div class="notif-toolbar">
      <div class="segmented" role="group" aria-label="Filter notifications">
        <button type="button" data-filter="all" aria-pressed="${state.filter === 'all'}">All <span class="seg-count">${state.items.length}</span></button>
        <button type="button" data-filter="unread" aria-pressed="${state.filter === 'unread'}">Unread <span class="seg-count">${unreadCount()}</span></button>
      </div>
    </div>`;
  }

  function permissionCard() {
    const permission = notificationSupport();
    const supported = permission !== 'unsupported';
    const on = Boolean(profile.notificationsOn) && permission === 'granted';
    const status =
      permission === 'granted'
        ? { tone: 'sage', text: 'Allowed in this browser' }
        : permission === 'denied'
        ? { tone: 'rose', text: 'Blocked in browser settings' }
        : permission === 'unsupported'
        ? { tone: 'muted', text: 'Not supported here' }
        : { tone: 'ochre', text: 'Not asked yet' };
    return `<section class="rail-card card notif-permission">
      <div class="rail-card__head">
        <span class="card-kicker">Browser nudges</span>
        <span class="notif-permission__status tone tone--${status.tone}">${status.text}</span>
      </div>
      <div class="switch-row">
        <span class="switch-row__text">
          <span class="switch-row__title">Allow notifications</span>
          <span class="switch-row__sub">A tap on the shoulder when a bill is close or a task slips.</span>
        </span>
        <label class="switch">
          <input type="checkbox" data-notif-toggle ${on ? 'checked' : ''} ${supported && permission !== 'denied' ? '' : 'disabled'} aria-label="Allow browser notifications">
          <span class="switch__track"></span>
        </label>
      </div>
      <button class="btn btn--sm btn--secondary" type="button" data-action="test" ${on ? '' : 'disabled'}>
        ${icon('bell', 14)} Send a test
      </button>
      <p class="tiny muted notif-permission__note">In-app nudges stay here either way. Browser notifications add a ping outside the tab — nothing more.</p>
    </section>`;
  }

  function rail() {
    const unread = unreadCount();
    return `<aside class="notif-rail" aria-label="How nudges work">
      <section class="rail-card card rail-card--puffy rail-card--pip">
        ${pip({ mood: unread ? 'happy' : 'sleepy', size: 62 })}
        <div>
          <span class="card-kicker">Puffy says</span>
          <p class="rail-puffy rail-pip">${
            unread
              ? `${unread === 1 ? 'One nudge is' : `${unread} nudges are`} waiting. Open, read, delete — then let the list be quiet.`
              : 'Nothing needs you right now. I’ll speak up when a date gets close.'
          }</p>
        </div>
      </section>
      ${permissionCard()}
      <section class="rail-card card rail-card--quiet">
        <span class="card-kicker">What I watch</span>
        <ul class="notif-watch">
          <li>${icon('receipt', 15)}<span>Bills inside your reminder window</span></li>
          <li>${icon('tasks', 15)}<span>Tasks that slipped past their date</span></li>
          <li>${icon('chart', 15)}<span>Budget lines at 80% and 100%</span></li>
          <li>${icon('book', 15)}<span>A weekly review nudge on Sunday</span></li>
        </ul>
        <p class="tiny muted">No marketing, no streaks to protect, no “you haven’t opened the app” guilt.</p>
        <a class="card-link" href="#/settings">Choose what Puffy mentions ${icon('chevron-right', 13)}</a>
      </section>
    </aside>`;
  }

  function paint() {
    root.innerHTML = `<div class="page notif-page">
      ${pageHead({
        eyebrow: 'A gentle tap',
        title: 'Nudges, not noise.',
        sub: 'Bills, dates, and small things about to slip. Read one, clear it, and get back to your day.',
        actions: `
          <button class="btn btn--ghost" type="button" data-action="mark-all" ${unreadCount() ? '' : 'disabled'}>${icon('check-circle', 16)} Mark all read</button>
          <button class="btn btn--primary" type="button" data-action="check">${icon('refresh', 16)} Check for reminders</button>`,
      })}
      <div class="notif-layout">
        <div class="notif-main">
          ${toolbar()}
          ${list()}
        </div>
        ${rail()}
      </div>
    </div>`;
  }

  async function refresh() {
    const token = ++generation;
    const items = await getNotifications();
    if (token !== generation) return;
    state.items = items;
    paint();
    ctx.refreshBadges();
  }

  function closeMenus() {
    root.querySelectorAll('details[open]').forEach((d) => d.removeAttribute('open'));
  }

  async function setRead(id, read) {
    const item = findItem(id);
    if (!item) return;
    const updated = await markNotificationRead(id, read);
    if (updated) state.items = state.items.map((n) => (n.id === id ? updated : n));
    paint();
    ctx.refreshBadges();
  }

  async function openItem(id) {
    const item = findItem(id);
    if (!item) return;
    if (!item.read) await markNotificationRead(id, true);
    if (item.link) {
      const path = item.link.replace(/^#\/?/, '');
      ctx.navigate(path);
    } else {
      await refresh();
    }
  }

  async function checkReminders() {
    try {
      const created = await generateReminders(today);
      await refresh();
      toast(
        created.length
          ? `${created.length} new nudge${created.length === 1 ? '' : 's'} added.`
          : 'Nothing new to nudge about. The dates are clear.',
        { type: created.length ? 'success' : 'info' }
      );
      if (created.length && profile.notificationsOn && notificationSupport() === 'granted') {
        showNotification(
          created.length === 1 ? created[0].title : `${created.length} new nudges from Puffy`,
          {
            body: created.length === 1 ? created[0].body : 'A bill is close or a task slipped. Open the list when you have a minute.',
            tag: 'puffy-reminders',
            link: '#/notifications',
          }
        );
      }
    } catch (err) {
      console.error(err);
      toastError('Could not check for reminders right now.');
    }
  }

  async function toggleBrowserNotifications(input) {
    if (notificationSupport() === 'unsupported') {
      input.checked = false;
      toastError('This browser does not support notifications.');
      return;
    }
    if (!input.checked) {
      profile = await ctx.updateProfile({ notificationsOn: false });
      paint();
      toast('Browser notifications off. In-app nudges stay here.', { type: 'info' });
      return;
    }
    try {
      const permission = await requestNotificationPermission();
      if (permission !== 'granted') {
        input.checked = false;
        toastError(
          permission === 'denied'
            ? 'Notifications are blocked in the browser settings for this site.'
            : 'Permission was not granted. You can ask again from browser settings.'
        );
        paint();
        return;
      }
      profile = await ctx.updateProfile({ notificationsOn: true });
      paint();
      toast('Browser notifications on. Puffy will keep it rare.');
    } catch (err) {
      console.error(err);
      input.checked = false;
      toastError('Browser notifications could not be enabled.');
    }
  }

  async function sendTest() {
    if (notificationSupport() !== 'granted') {
      toastError('Allow notifications first.');
      return;
    }
    const sent = await showNotification('Puffy is here', {
      body: 'A quiet test. Real nudges only appear when a date gets close.',
      tag: 'pla-test',
      link: '#/notifications',
    });
    if (sent) toast('Test notification sent.', { type: 'success' });
    else toastError('The test notification could not be sent.');
  }

  async function onClick(event) {
    const filter = event.target.closest('[data-filter]');
    if (filter) {
      state.filter = filter.dataset.filter;
      paint();
      return;
    }
    if (event.target.closest('[data-filter-reset]')) {
      state.filter = 'all';
      paint();
      return;
    }

    const actionEl = event.target.closest('[data-action]');
    if (!actionEl) return;
    const action = actionEl.dataset.action;
    const row = actionEl.closest('[data-id]');
    const item = row ? findItem(row.dataset.id) : null;
    closeMenus();

    if (action === 'check') return checkReminders();
    if (action === 'test') return sendTest();
    if (action === 'mark-all') {
      if (!unreadCount()) return;
      await markAllNotificationsRead();
      await refresh();
      toast('All caught up.');
      return;
    }
    if (!item) return;
    if (action === 'open') return openItem(item.id);
    if (action === 'toggle-read') return setRead(item.id, !item.read);
    if (action === 'delete') {
      await deleteNotification(item.id);
      state.items = state.items.filter((n) => n.id !== item.id);
      paint();
      ctx.refreshBadges();
      toast('Nudge removed.', { type: 'info' });
    }
  }

  function onChange(event) {
    const toggle = event.target.closest('[data-notif-toggle]');
    if (toggle) toggleBrowserNotifications(toggle);
  }

  root.addEventListener('click', onClick);
  root.addEventListener('change', onChange);
  paint();

  return {
    destroy() {
      root.removeEventListener('click', onClick);
      root.removeEventListener('change', onChange);
    },
  };
}
