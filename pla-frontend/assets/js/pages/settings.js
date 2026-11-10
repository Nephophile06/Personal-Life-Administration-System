import {
  getDataStats,
  getExportData,
  resetDemoData,
} from '../api.js';
import {
  ACCENTS,
  THEME_LABEL,
  applyAccent,
  applyTheme,
  getThemePref,
} from '../theme.js';
import { MASCOT_FORMS, MASCOT_STYLES, applyMascotStyle, applyMascotForm, pip, pipGlyph } from '../mascot.js';
import { icon } from '../icons.js';
import {
  FREQUENCIES,
  PRIORITIES,
  billKind,
  categoryMeta,
} from '../constants.js';
import { habitBestStreak, habitStreak } from '../analytics.js';
import {
  esc,
  initials,
  timeToMinutes,
  todayISO,
} from '../ui/format.js';
import { pageHead } from '../ui/widgets.js';
import { openSheet, confirmSheet } from '../ui/sheet.js';
import { toast, toastError } from '../ui/toast.js';
import { downloadCSV, toCSV } from '../ui/csv.js';
import { getPwaStatus } from '../pwa.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DATASETS = [
  { id: 'tasks', label: 'Tasks', note: 'Titles, status, due dates, estimates', icon: 'tasks' },
  { id: 'expenses', label: 'Expenses & income', note: 'Every transaction in the ledger', icon: 'card' },
  { id: 'bills', label: 'Bills', note: 'Amounts, frequency, next due dates', icon: 'receipt' },
  { id: 'habits', label: 'Habits', note: 'Cadence, targets and check-in totals', icon: 'sprout' },
  { id: 'goals', label: 'Goals', note: 'Progress, units and target dates', icon: 'target' },
  { id: 'all', label: 'Everything', note: 'One row per record, ready to filter', icon: 'inbox' },
];

const accentFor = (id) => ACCENTS.find((a) => a.id === id) || ACCENTS[0];
const mascotFor = (id) => MASCOT_STYLES.find((s) => s.id === id) || MASCOT_STYLES[0];
const formFor = (id) => MASCOT_FORMS.find((f) => f.id === id) || MASCOT_FORMS[0];
const priorityLabel = (id) => PRIORITIES.find((p) => p.id === id)?.label || id || '';
const categoryLabel = (id) => categoryMeta(id).label;
const frequencyLabel = (id) => FREQUENCIES.find((f) => f.id === id)?.label || id || '';
const cadenceLabel = (habit) =>
  habit.cadence === 'daily' ? 'Every day' : `${habit.targetPerWeek || 1}× a week`;
const cleanHours = (value, fallback) => (/^\d{2}:\d{2}$/.test(value || '') ? value : fallback);
const hourLabel = (value) => String(value || '').replace(/^0/, '');
const windowLabel = (profile) =>
  `${hourLabel(cleanHours(profile.workStart, '09:00'))}–${hourLabel(cleanHours(profile.workEnd, '17:30'))}`;

const isStandalone = () => {
  try {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    );
  } catch {
    return false;
  }
};

/* ---- CSV shaping ---------------------------------------------------------- */

const TASK_COLUMNS = [
  { label: 'Title', value: (t) => t.title },
  { label: 'Status', value: (t) => (t.done ? 'Done' : 'Open') },
  { label: 'Priority', value: (t) => priorityLabel(t.priority) },
  { label: 'Due', value: (t) => t.due || '' },
  { label: 'Estimate (min)', value: (t) => t.estimate ?? '' },
  { label: 'Category', value: (t) => categoryLabel(t.category) },
  { label: 'Notes', value: (t) => t.notes || '' },
];

const EXPENSE_COLUMNS = [
  { label: 'Date', value: (t) => t.date || '' },
  { label: 'Description', value: (t) => t.note || '' },
  { label: 'Category', value: (t) => categoryLabel(t.category) },
  { label: 'Type', value: (t) => (t.type === 'income' ? 'Income' : 'Expense') },
  { label: 'Amount', value: (t) => Number(t.amount) || 0 },
  { label: 'Bill payment', value: (t) => (t.billId ? 'Yes' : '') },
];

const BILL_COLUMNS = [
  { label: 'Name', value: (b) => b.name },
  { label: 'Kind', value: (b) => billKind(b.kind).label },
  { label: 'Amount', value: (b) => Number(b.amount) || 0 },
  { label: 'Frequency', value: (b) => frequencyLabel(b.frequency) },
  { label: 'Next due', value: (b) => b.nextDue || '' },
  { label: 'Payments logged', value: (b) => (b.payments || []).length },
  { label: 'Last paid', value: (b) => b.lastPaid || '' },
  { label: 'Notes', value: (b) => b.notes || '' },
];

const HABIT_COLUMNS = [
  { label: 'Habit', value: (h) => h.name },
  { label: 'Cadence', value: (h) => cadenceLabel(h) },
  { label: 'Weekly target', value: (h) => h.targetPerWeek || 1 },
  { label: 'Check-ins', value: (h) => Object.keys(h.log || {}).length },
  { label: 'Current streak', value: (h) => habitStreak(h) },
  { label: 'Best streak', value: (h) => habitBestStreak(h) },
  { label: 'Created', value: (h) => (h.createdAt || '').slice(0, 10) },
];

const GOAL_COLUMNS = [
  { label: 'Goal', value: (g) => g.title },
  { label: 'Current', value: (g) => Number(g.current) || 0 },
  { label: 'Target', value: (g) => Number(g.target) || 0 },
  { label: 'Unit', value: (g) => g.unit || '' },
  { label: 'Percent', value: (g) => Math.round(((Number(g.current) || 0) / (Number(g.target) || 1)) * 100) },
  { label: 'Target date', value: (g) => g.targetDate || '' },
  { label: 'Notes', value: (g) => g.note || '' },
];

const ALL_COLUMNS = [
  { label: 'Table', value: (r) => r.table },
  { label: 'Title', value: (r) => r.title },
  { label: 'Date', value: (r) => r.date },
  { label: 'Amount', value: (r) => r.amount },
  { label: 'Category', value: (r) => r.category },
  { label: 'Status', value: (r) => r.status },
  { label: 'Detail', value: (r) => r.detail },
];

function buildAllRows(data) {
  const rows = [];
  data.tasks.forEach((t) =>
    rows.push({
      table: 'Task',
      title: t.title,
      date: t.due || '',
      amount: '',
      category: 'Task',
      status: t.done ? 'Done' : 'Open',
      detail: [priorityLabel(t.priority), t.estimate ? `${t.estimate} min` : '', t.notes || '']
        .filter(Boolean)
        .join(' · '),
    })
  );
  data.transactions.forEach((t) =>
    rows.push({
      table: 'Transaction',
      title: t.note || categoryLabel(t.category),
      date: t.date || '',
      amount: Number(t.amount) || 0,
      category: categoryLabel(t.category),
      status: t.type === 'income' ? 'Income' : 'Expense',
      detail: t.billId ? 'Bill payment' : '',
    })
  );
  data.bills.forEach((b) =>
    rows.push({
      table: 'Bill',
      title: b.name,
      date: b.nextDue || '',
      amount: Number(b.amount) || 0,
      category: billKind(b.kind).label,
      status: 'Recurring',
      detail: [frequencyLabel(b.frequency), `${(b.payments || []).length} payments logged`, b.notes || '']
        .filter(Boolean)
        .join(' · '),
    })
  );
  data.habits.forEach((h) =>
    rows.push({
      table: 'Habit',
      title: h.name,
      date: (h.createdAt || '').slice(0, 10),
      amount: '',
      category: 'Habit',
      status: cadenceLabel(h),
      detail: `${Object.keys(h.log || {}).length} check-ins · best ${habitBestStreak(h)}`,
    })
  );
  data.goals.forEach((g) =>
    rows.push({
      table: 'Goal',
      title: g.title,
      date: g.targetDate || '',
      amount: '',
      category: 'Goal',
      status: `${g.current || 0} of ${g.target || 0} ${g.unit || ''}`.trim(),
      detail: g.note || '',
    })
  );
  data.checkins.forEach((c) =>
    rows.push({
      table: 'Check-in',
      title: `Mood ${c.mood || 0}/5`,
      date: c.date || '',
      amount: '',
      category: 'Mood',
      status: c.mood ? `${c.mood}/5` : '',
      detail: c.note || '',
    })
  );
  (data.notifications || []).forEach((n) =>
    rows.push({
      table: 'Notification',
      title: n.title || '',
      date: String(n.ts || '').slice(0, 10),
      amount: '',
      category: n.type || 'system',
      status: n.read ? 'Read' : 'Unread',
      detail: n.body || '',
    })
  );
  return rows.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

function buildExport(kind, data) {
  if (kind === 'tasks') {
    const rows = data.tasks.slice().sort((a, b) => (a.due || '').localeCompare(b.due || ''));
    return { csv: toCSV(TASK_COLUMNS, rows), count: rows.length, noun: 'tasks' };
  }
  if (kind === 'expenses') {
    const rows = data.transactions.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    return { csv: toCSV(EXPENSE_COLUMNS, rows), count: rows.length, noun: 'transactions' };
  }
  if (kind === 'bills') {
    const rows = data.bills.slice().sort((a, b) => (a.nextDue || '').localeCompare(b.nextDue || ''));
    return { csv: toCSV(BILL_COLUMNS, rows), count: rows.length, noun: 'bills' };
  }
  if (kind === 'habits') {
    return { csv: toCSV(HABIT_COLUMNS, data.habits), count: data.habits.length, noun: 'habits' };
  }
  if (kind === 'goals') {
    return { csv: toCSV(GOAL_COLUMNS, data.goals), count: data.goals.length, noun: 'goals' };
  }
  const rows = buildAllRows(data);
  return { csv: toCSV(ALL_COLUMNS, rows), count: rows.length, noun: 'records' };
}

/* ========================================================================== */

export default async function settingsPage(root, ctx) {
  let profile = ctx.getProfile();
  let stats = null;

  root.innerHTML = `<div class="page settings-page">
    <div class="page-loading" aria-busy="true">
      <div class="skeleton page-loading__head"></div>
      <div class="skeleton page-loading__row"></div>
      <div class="skeleton page-loading__row"></div>
      <span class="sr-only">Loading your settings</span>
    </div>
  </div>`;

  try {
    stats = await getDataStats();
  } catch (err) {
    console.warn('Could not read local record counts', err);
  }

  let exportCache = null;

  const chosenAccent = () => accentFor(profile.accent);
  const chosenMascot = () => mascotFor(profile.mascotStyle);
  const chosenForm = () => formFor(profile.mascotForm);
  // Normalise older stored ids ('classic', retired 'kite') to the current set.
  const currentStyleId = () =>
    MASCOT_STYLES.some((s) => s.id === profile.mascotStyle) ? profile.mascotStyle : 'slate';
  const currentFormId = () =>
    MASCOT_FORMS.some((f) => f.id === profile.mascotForm) ? profile.mascotForm : 'lantern';

  /* ---- Markup ------------------------------------------------------------ */

  const accentChoices = ACCENTS.map(
    (a) => `<button class="accent-choice" type="button" data-accent-choice="${a.id}"
      aria-pressed="${profile.accent === a.id}" title="${a.label}" style="--swatch:${a.hex}">
      <span class="accent-choice__dot" aria-hidden="true">
        <span class="accent-choice__check">${icon('check', 11)}</span>
      </span>
      <span class="accent-choice__label">${a.label}</span>
    </button>`
  ).join('');

  const mascotChoices = MASCOT_STYLES.map(
    (s) => `<button class="puffy-choice pip-choice" type="button" data-mascot-choice="${s.id}"
      aria-pressed="${currentStyleId() === s.id}">
      <span class="puffy-choice__swatch pip-choice__swatch" aria-hidden="true" style="--swatch:${s.swatch}"></span>
      <span>${s.label}</span>
    </button>`
  ).join('');

  const formChoices = MASCOT_FORMS.map(
    (f) => `<button class="puffy-form pip-form" type="button" data-puffy-form-choice="${f.id}" data-pip-form-choice="${f.id}"
      aria-pressed="${currentFormId() === f.id}" title="${f.label}">
      <span class="puffy-form__art pip-form__art" aria-hidden="true">${pip({ form: f.id, mood: 'happy', size: 42 })}</span>
      <span class="puffy-form__label pip-form__label">${f.label}</span>
    </button>`
  ).join('');

  const installLabel = isStandalone()
    ? 'Puffy is installed'
    : window.__plaInstallPrompt
      ? 'Install Puffy'
      : 'How to install';

  const dataCounts = stats
    ? {
        tasks: stats.tasks,
        expenses: stats.transactions,
        bills: stats.bills,
        habits: stats.habits,
        goals: stats.goals,
        all: stats.total,
      }
    : {};

  const leadDays = Math.min(30, Math.max(0, Number(profile.remindDaysBefore ?? 3)));
  const nudgeRow = (key, title, sub) => `<div class="switch-row settings-switch settings-nudge">
      <span class="switch-row__text">
        <span class="switch-row__title">${title}</span>
        <span class="switch-row__sub">${sub}</span>
      </span>
      <label class="switch">
        <input type="checkbox" data-notify-toggle="${key}" ${profile[key] !== false ? 'checked' : ''}
          aria-label="${title}">
        <span class="switch__track"></span>
      </label>
    </div>`;

  root.innerHTML = `<div class="page settings-page">
    ${pageHead({
      eyebrow: 'Make it yours',
      title: 'A desk that fits only you.',
      sub: 'Your name, your palette, the hours Puffy may use — and a clean way to take your data with you.',
      actions: `
        <button class="btn btn--ghost btn--sm" type="button" data-export>${icon('download', 15)} Export data</button>
        <button class="btn btn--primary btn--sm" type="button" data-install ${isStandalone() ? 'disabled' : ''}>
          ${icon(isStandalone() ? 'check-circle' : 'download', 15)}
          <span data-install-label>${installLabel}</span>
        </button>`,
    })}

    <div class="ledger settings-ledger" role="group" aria-label="Your settings at a glance">
      <div class="ledger-cell" data-ledger-cell="accent">
        <span class="ledger-cell__label"><span class="pill-dot" aria-hidden="true"></span>Profile</span>
        <span class="ledger-cell__value" data-summary-name>${esc(profile.name)}</span>
        <span class="ledger-cell__note" data-summary-name-note>${esc(profile.email || 'Saved on this device')}</span>
      </div>
      <div class="ledger-cell" data-ledger-cell="ochre">
        <span class="ledger-cell__label"><span class="pill-dot" aria-hidden="true"></span>Palette</span>
        <span class="ledger-cell__value" data-summary-accent>${chosenAccent().label}</span>
        <span class="ledger-cell__note" data-summary-accent-note>${chosenForm().label} Puffy · ${THEME_LABEL[getThemePref()]} theme</span>
      </div>
      <div class="ledger-cell" data-ledger-cell="sage">
        <span class="ledger-cell__label"><span class="pill-dot" aria-hidden="true"></span>Working hours</span>
        <span class="ledger-cell__value" data-summary-hours>${windowLabel(profile)}</span>
        <span class="ledger-cell__note">planner stays inside it</span>
      </div>
      <div class="ledger-cell">
        <span class="ledger-cell__label"><span class="pill-dot" aria-hidden="true"></span>On this device</span>
        <span class="ledger-cell__value" data-summary-records>${stats ? `${stats.total} records` : '—'}</span>
        <span class="ledger-cell__note">local only · no cloud</span>
      </div>
    </div>

    <div class="settings-layout">
      <div class="settings-main">

        <section class="card settings-card" aria-labelledby="settings-profile-title">
          <header class="settings-card__head">
            <span class="settings-card__icon tone tone--accent" aria-hidden="true">${icon('user', 19)}</span>
            <div class="grow">
              <h2 id="settings-profile-title">You</h2>
              <p class="settings-card__sub">The name Puffy uses, and the mark beside it.</p>
            </div>
          </header>

          <div class="settings-profile">
            <div class="settings-portrait" data-portrait aria-hidden="true">${renderPortrait()}</div>
            <div class="settings-profile__main">
              <form class="settings-form" data-profile-form novalidate>
                <div class="field-row">
                  <div class="field">
                    <label for="settings-name">Name</label>
                    <input class="input" id="settings-name" name="name" autocomplete="name"
                      maxlength="40" value="${esc(profile.name)}" required>
                  </div>
                  <div class="field">
                    <label for="settings-email">Email <span class="muted">(optional)</span></label>
                    <input class="input" id="settings-email" name="email" type="email"
                      autocomplete="email" maxlength="80" value="${esc(profile.email || '')}"
                      placeholder="you@example.com">
                  </div>
                </div>
                <p class="field__error" data-profile-error role="alert"></p>
                <div class="settings-actions">
                  <span class="tiny muted settings-actions__note">${icon('lock', 12)} Stored only in this browser</span>
                  <button class="btn btn--primary btn--sm" type="submit">Save profile</button>
                </div>
              </form>

              <div class="settings-avatar">
                <span class="settings-subhead">Your mark</span>
                <div class="avatar-toggle" role="group" aria-label="Avatar style">
                  <button class="avatar-toggle__btn" type="button" data-avatar-style="initials"
                    aria-pressed="${(profile.avatarStyle || 'initials') === 'initials'}">
                    <span class="avatar-toggle__dot">${initials(profile.name)}</span>
                    Initials
                  </button>
                  <button class="avatar-toggle__btn" type="button" data-avatar-style="puffy"
                    aria-pressed="${(profile.avatarStyle === 'puffy' || profile.avatarStyle === 'pip')}">
                    <span class="avatar-toggle__dot avatar-toggle__dot--puffy avatar-toggle__dot--pip">${pipGlyph(17)}</span>
                    Puffy
                  </button>
                </div>
                <p class="settings-hint">Shown in the sidebar and top bar.</p>
              </div>
            </div>
          </div>
        </section>

        <section class="card settings-card" aria-labelledby="settings-look-title">
          <header class="settings-card__head">
            <span class="settings-card__icon tone tone--ochre" aria-hidden="true">${icon('palette', 19)}</span>
            <div class="grow">
              <h2 id="settings-look-title">Look &amp; feel</h2>
              <p class="settings-card__sub">One accent, three themes, and a Puffy that feels like yours.</p>
            </div>
          </header>

          <div class="settings-block">
            <h3 class="settings-subhead">Accent</h3>
            <div class="accent-grid" role="group" aria-label="Accent colour">${accentChoices}</div>
          </div>

          <div class="settings-block">
            <h3 class="settings-subhead">Theme</h3>
            <div class="segmented settings-seg" role="group" aria-label="Theme">
              <button type="button" data-theme-choice="light" aria-pressed="${getThemePref() === 'light'}">
                ${icon('sun', 15)} Light
              </button>
              <button type="button" data-theme-choice="dark" aria-pressed="${getThemePref() === 'dark'}">
                ${icon('moon', 15)} Dark
              </button>
              <button type="button" data-theme-choice="auto" aria-pressed="${getThemePref() === 'auto'}">
                ${icon('auto', 15)} Auto
              </button>
            </div>
            <p class="settings-hint">Auto follows this device’s light or dark setting.</p>
          </div>

          <div class="settings-block">
            <h3 class="settings-subhead">Puffy’s look</h3>
            <div class="puffy-studio pip-studio">
              <div class="puffy-studio__preview pip-studio__preview" data-mascot-preview>${pip({ mood: 'happy', size: 104 })}</div>
              <div class="puffy-studio__side pip-studio__side">
                <span class="puffy-studio__label pip-studio__label">Form</span>
                <div class="puffy-forms pip-forms" role="group" aria-label="Puffy’s form">${formChoices}</div>
                <span class="puffy-studio__label pip-studio__label">Colour</span>
                <div class="puffy-choices pip-choices" role="group" aria-label="Puffy’s colour">${mascotChoices}</div>
                <p class="settings-hint" data-mascot-note>${chosenForm().note}. ${chosenMascot().note}.</p>
              </div>
            </div>
          </div>
        </section>

        <section class="card settings-card" aria-labelledby="settings-hours-title">
          <header class="settings-card__head">
            <span class="settings-card__icon tone tone--sage" aria-hidden="true">${icon('clock', 19)}</span>
            <div class="grow">
              <h2 id="settings-hours-title">Working hours</h2>
              <p class="settings-card__sub">The planner only places work between these two times.</p>
            </div>
          </header>

          <form class="settings-form" data-hours-form novalidate>
            <div class="settings-hours">
              <div class="field">
                <label for="work-start">Start</label>
                <input class="input" id="work-start" name="workStart" type="time" step="900"
                  value="${cleanHours(profile.workStart, '09:00')}">
              </div>
              <span class="settings-hours__dash" aria-hidden="true">—</span>
              <div class="field">
                <label for="work-end">Finish</label>
                <input class="input" id="work-end" name="workEnd" type="time" step="900"
                  value="${cleanHours(profile.workEnd, '17:30')}">
              </div>
            </div>
            <p class="field__error" data-hours-error role="alert"></p>
            <p class="settings-hint">Puffy leaves 5–10 minute breaths between blocks, and never schedules inside a busy block.</p>
            <div class="settings-actions">
              <button class="linkish" type="button" data-hours-defaults>Use 9:00–17:30</button>
              <button class="btn btn--primary btn--sm" type="submit">Save hours</button>
            </div>
          </form>
        </section>

        <section class="card settings-card" aria-labelledby="settings-assist-title">
          <header class="settings-card__head">
            <span class="settings-card__icon tone tone--accent" aria-hidden="true">${icon('wand', 19)}</span>
            <div class="grow">
              <h2 id="settings-assist-title">Puffy’s help</h2>
              <p class="settings-card__sub">How much of the planning you want to hand over.</p>
            </div>
          </header>

          <div class="switch-row settings-switch">
            <span class="switch-row__text">
              <span class="switch-row__title">Let Puffy draft plans with AI</span>
              <span class="switch-row__sub">A future backend can rewrite the draft in plainer language. Nothing leaves this browser today.</span>
            </span>
            <label class="switch">
              <input type="checkbox" data-ai-toggle ${profile.aiOn ? 'checked' : ''}
                aria-label="Let Puffy draft plans with AI">
              <span class="switch__track"></span>
            </label>
          </div>
          <p class="settings-hint" data-ai-note>${aiNote(profile.aiOn)}</p>
          <div class="settings-assist__meta">
            <span class="tag tag--sage">${icon('sparkles', 11)} Local scoring on</span>
            <span class="tag">Model not connected</span>
          </div>
        </section>

        <section class="card settings-card" aria-labelledby="settings-nudges-title">
          <header class="settings-card__head">
            <span class="settings-card__icon tone tone--ochre" aria-hidden="true">${icon('bell', 19)}</span>
            <div class="grow">
              <h2 id="settings-nudges-title">Nudges</h2>
              <p class="settings-card__sub">What Puffy may mention, and how early. No marketing, ever.</p>
            </div>
          </header>

          <div class="settings-nudges">
            ${nudgeRow('notifyBills', 'Bills due soon', 'A note before rent, utilities and subscriptions come out.')}
            ${nudgeRow('notifyTasks', 'Tasks that slipped', 'One daily note when something passes its date.')}
            ${nudgeRow('notifyBudgets', 'Budget lines', 'Warn at 80% of a category, and again when it reaches 100%.')}
            ${nudgeRow('notifyReview', 'Weekly review', 'A Sunday note when the week is ready to look back on.')}
          </div>

          <form class="settings-form settings-remind-form" data-remind-form novalidate>
            <div class="settings-remind">
              <label class="settings-remind__label" for="remind-days">Default reminder window</label>
              <span class="settings-remind__control">
                <input class="input" id="remind-days" name="remindDaysBefore" type="number"
                  min="0" max="30" step="1" inputmode="numeric" value="${leadDays}">
                <span class="settings-remind__unit">days before</span>
              </span>
            </div>
            <p class="field__error" data-remind-error role="alert"></p>
            <p class="settings-hint">Each bill can override this in its own editor. Zero means “on the day”.</p>
            <div class="settings-actions">
              <span class="settings-actions__note tiny muted">In-app nudges stay here even when browser notifications are off.</span>
              <button class="btn btn--primary btn--sm" type="submit">Save window</button>
            </div>
          </form>
        </section>

        <section class="card settings-card" aria-labelledby="settings-data-title">
          <header class="settings-card__head">
            <span class="settings-card__icon tone tone--sage" aria-hidden="true">${icon('download', 19)}</span>
            <div class="grow">
              <h2 id="settings-data-title">Your data</h2>
              <p class="settings-card__sub">Everything is portable. CSV opens in Numbers, Excel or Sheets.</p>
            </div>
          </header>

          <div class="settings-data">
            <div class="settings-data__row">
              <div class="settings-data__text">
                <strong>Export your desk</strong>
                <p>${stats ? `${stats.total} records are waiting on this device.` : 'Counts are unavailable right now, but the export will try.'} Nothing is uploaded.</p>
              </div>
              <button class="btn btn--secondary btn--sm" type="button" data-export>
                ${icon('download', 15)} Choose &amp; export
              </button>
            </div>
            <div class="settings-data__grid">
              ${DATASETS.map(
                (d) => `<button class="settings-data__tile" type="button" data-export-quick="${d.id}">
                  <span class="settings-data__tile-icon">${icon(d.icon, 16)}</span>
                  <span class="settings-data__tile-text">
                    <strong>${d.label}</strong>
                    <small>${dataCounts[d.id] ?? 0} ${d.id === 'all' ? 'records' : 'rows'}</small>
                  </span>
                </button>`
              ).join('')}
            </div>
          </div>
        </section>

        <section class="card settings-card settings-danger" aria-labelledby="settings-reset-title">
          <header class="settings-card__head">
            <span class="settings-card__icon tone tone--rose" aria-hidden="true">${icon('refresh', 19)}</span>
            <div class="grow">
              <h2 id="settings-reset-title">A clean slate</h2>
              <p class="settings-card__sub">Start the demo week again without losing your name or preferences.</p>
            </div>
          </header>
          <div class="settings-danger__row">
            <p>Tasks, bills, expenses, habits, goals and history return to Maya’s fresh demo week. Your name, palette, hours and avatar stay as they are.</p>
            <button class="btn btn--danger btn--sm" type="button" data-reset>Reset demo data</button>
          </div>
        </section>

        <p class="settings-foot tiny muted">${icon('leaf', 13)} Puffy is local-first: no account, no server, no tracking. Export a CSV whenever you want a copy.</p>
      </div>

      <aside class="settings-rail" aria-label="Settings side notes">
        <section class="card rail-card rail-card--puffy rail-card--pip settings-rail__puffy settings-rail__pip">
          ${pip({ mood: 'happy', size: 54 })}
          <div>
            <span class="card-kicker">Puffy says</span>
            <p class="rail-puffy rail-pip">Your desk is yours. I only keep what you give me — and I never send it anywhere.</p>
          </div>
        </section>

        <section class="card rail-card settings-stats-card">
          <div class="rail-card__head">
            <h2 class="rail-card__title">At a glance</h2>
            <span class="tag tag--xs">${stats ? `${stats.total} records` : '—'}</span>
          </div>
          <ul class="settings-stats">
            <li><span>Open tasks</span><strong>${stats ? stats.tasksOpen : '—'}</strong></li>
            <li><span>Bills tracked</span><strong>${stats ? stats.bills : '—'}</strong></li>
            <li><span>Transactions</span><strong>${stats ? stats.transactions : '—'}</strong></li>
            <li><span>Habits &amp; goals</span><strong>${stats ? stats.habits + stats.goals : '—'}</strong></li>
            <li><span>Check-ins</span><strong>${stats ? stats.checkins : '—'}</strong></li>
            <li class="settings-stats__total"><span>Everything</span><strong>${stats ? stats.total : '—'}</strong></li>
          </ul>
        </section>

        <section class="card rail-card settings-install" data-install-card>
          <span class="eyebrow eyebrow--plain">On your home screen</span>
          <h2 class="rail-card__title" data-install-title>${installTitle()}</h2>
          <p class="rail-card__sub" data-install-status>${installStatus()}</p>
          <ol class="install-steps settings-install__steps">
            <li>Open Puffy in Chrome, Edge or Safari.</li>
            <li>Use the browser menu: <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li>
            <li>Confirm. Puffy opens full-screen and keeps your data.</li>
          </ol>
          <p class="settings-hint">Install is offered when Puffy is served over HTTPS or localhost.</p>
        </section>

        <p class="settings-version tiny muted">Puffy · local-first · v1.3<br><span>Data contract v1 · IndexedDB</span><br><span data-sw-status>Offline shell: checking…</span></p>
      </aside>
    </div>
  </div>`;

  /* ---- Little painters --------------------------------------------------- */

  function renderPortrait() {
    if ((profile.avatarStyle === 'puffy' || profile.avatarStyle === 'pip')) return pip({ mood: 'happy', size: 84 });
    return `<span class="avatar avatar--xl">${initials(profile.name)}</span>`;
  }

  function aiNote(on) {
    return on
      ? 'AI assist is on. Until a model endpoint exists, every plan still comes from Puffy’s local urgency, importance and effort rules.'
      : 'AI assist is off. Puffy will only use the local scoring rules — no model, no waiting.';
  }

  function installTitle() {
    if (isStandalone()) return 'Puffy is installed.';
    if (window.__plaInstallPrompt) return 'One tap away.';
    return 'A place on your home screen.';
  }

  function installStatus() {
    if (isStandalone()) return 'Open Puffy from your home screen. It works offline and opens without the address bar.';
    if (window.__plaInstallPrompt) return 'Your browser is ready to install Puffy as an app.';
    return 'Use the browser menu to install Puffy. The steps are below.';
  }

  function paintSummary() {
    const nameEl = root.querySelector('[data-summary-name]');
    if (nameEl) nameEl.textContent = profile.name;
    const emailEl = root.querySelector('[data-summary-name-note]');
    if (emailEl) emailEl.textContent = profile.email || 'Saved on this device';
    const accentEl = root.querySelector('[data-summary-accent]');
    if (accentEl) accentEl.textContent = chosenAccent().label;
    const accentNote = root.querySelector('[data-summary-accent-note]');
    if (accentNote) accentNote.textContent = `${chosenForm().label} Puffy · ${THEME_LABEL[getThemePref()]} theme`;
    const hoursEl = root.querySelector('[data-summary-hours]');
    if (hoursEl) hoursEl.textContent = windowLabel(profile);
    const recordEl = root.querySelector('[data-summary-records]');
    if (recordEl) recordEl.textContent = stats ? `${stats.total} records` : '—';
  }

  function paintChoices() {
    root.querySelectorAll('[data-accent-choice]').forEach((btn) => {
      btn.setAttribute('aria-pressed', String(btn.dataset.accentChoice === chosenAccent().id));
    });
    root.querySelectorAll('[data-theme-choice]').forEach((btn) => {
      btn.setAttribute('aria-pressed', String(btn.dataset.themeChoice === getThemePref()));
    });
    root.querySelectorAll('[data-mascot-choice]').forEach((btn) => {
      btn.setAttribute('aria-pressed', String(btn.dataset.mascotChoice === chosenMascot().id));
    });
    root.querySelectorAll('[data-puffy-form-choice], [data-pip-form-choice]').forEach((btn) => {
      btn.setAttribute('aria-pressed', String((btn.dataset.puffyFormChoice || btn.dataset.pipFormChoice) === chosenForm().id));
    });
    root.querySelectorAll('[data-avatar-style]').forEach((btn) => {
      btn.setAttribute('aria-pressed', String(btn.dataset.avatarStyle === (profile.avatarStyle || 'initials')));
    });
    const portrait = root.querySelector('[data-portrait]');
    if (portrait) portrait.innerHTML = renderPortrait();
    const preview = root.querySelector('[data-mascot-preview]');
    if (preview) preview.innerHTML = pip({ mood: 'happy', size: 104 });
    const note = root.querySelector('[data-mascot-note]');
    if (note) note.textContent = `${chosenForm().note}. ${chosenMascot().note}.`;
  }

  function paintInstall() {
    const installed = isStandalone();
    root.querySelectorAll('[data-install]').forEach((btn) => {
      btn.disabled = installed;
    });
    const label = root.querySelector('[data-install-label]');
    if (label) {
      label.textContent = installed ? 'Puffy is installed' : window.__plaInstallPrompt ? 'Install Puffy' : 'How to install';
    }
    const title = root.querySelector('[data-install-title]');
    if (title) title.textContent = installTitle();
    const status = root.querySelector('[data-install-status]');
    if (status) status.textContent = installStatus();
  }

  /* ---- Saving ------------------------------------------------------------ */

  async function saveProfile(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const name = form.elements.name.value.trim();
    const email = form.elements.email.value.trim();
    const error = root.querySelector('[data-profile-error]');
    const submit = form.querySelector('button[type="submit"]');

    if (!name) {
      error.textContent = 'Puffy needs a name to greet — anything you like.';
      form.elements.name.focus();
      return;
    }
    if (email && !EMAIL_RE.test(email)) {
      error.textContent = 'That email does not look quite right.';
      form.elements.email.focus();
      return;
    }

    error.textContent = '';
    submit.disabled = true;
    submit.setAttribute('aria-busy', 'true');
    try {
      profile = await ctx.updateProfile({ name, email });
      paintSummary();
      paintChoices();
      toast('Profile saved. Puffy will use that name.');
    } catch (err) {
      console.warn('Could not save profile', err);
      toastError('That did not save. Check that this browser allows local storage.');
    } finally {
      submit.disabled = false;
      submit.removeAttribute('aria-busy');
    }
  }

  async function saveHours(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const start = form.elements.workStart.value;
    const end = form.elements.workEnd.value;
    const error = root.querySelector('[data-hours-error]');
    const submit = form.querySelector('button[type="submit"]');

    if (!start || !end) {
      error.textContent = 'Give Puffy both a start and a finish time.';
      return;
    }
    const span = timeToMinutes(end) - timeToMinutes(start);
    if (span < 30) {
      error.textContent = 'The window needs to be at least half an hour.';
      form.elements.workEnd.focus();
      return;
    }

    error.textContent = '';
    submit.disabled = true;
    submit.setAttribute('aria-busy', 'true');
    try {
      profile = await ctx.updateProfile({ workStart: start, workEnd: end });
      paintSummary();
      toast(`Working hours saved: ${windowLabel(profile)}.`);
    } catch (err) {
      console.warn('Could not save working hours', err);
      toastError('Those hours did not save. Try once more.');
    } finally {
      submit.disabled = false;
      submit.removeAttribute('aria-busy');
    }
  }

  async function chooseAccent(id) {
    const next = accentFor(id);
    if (profile.accent === next.id) return;
    const previous = profile.accent;
    applyAccent(next.id);
    profile = { ...profile, accent: next.id };
    paintChoices();
    paintSummary();
    try {
      profile = await ctx.updateProfile({ accent: next.id });
      toast(`${next.label} accent saved.`, { type: 'info', duration: 2000 });
    } catch (err) {
      console.warn('Could not save accent', err);
      profile = { ...profile, accent: previous };
      applyAccent(previous);
      paintChoices();
      paintSummary();
      toastError('The accent could not be saved.');
    }
  }

  async function chooseTheme(pref) {
    if (!THEME_LABEL[pref]) return;
    applyTheme(pref);
    paintChoices();
    paintSummary();
    try {
      profile = await ctx.updateProfile({ theme: pref });
      toast(`Theme set to ${THEME_LABEL[pref]}.`, { type: 'info', duration: 1800 });
    } catch (err) {
      console.warn('Could not save theme preference', err);
    }
  }

  async function chooseForm(id) {
    const next = formFor(id);
    if (currentFormId() === next.id) return;
    const previous = currentFormId();
    applyMascotForm(next.id);
    profile = { ...profile, mascotForm: next.id };
    paintChoices();
    paintSummary();
    try {
      profile = await ctx.updateProfile({ mascotForm: next.id });
      toast(`Puffy is a ${next.label.toLowerCase()} now.`, { type: 'info', duration: 2000 });
    } catch (err) {
      console.warn('Could not save Puffy form', err);
      profile = { ...profile, mascotForm: previous };
      applyMascotForm(previous);
      paintChoices();
      paintSummary();
      toastError('Puffy’s form could not be saved.');
    }
  }

  async function chooseMascot(id) {
    const next = mascotFor(id);
    if (currentStyleId() === next.id) return;
    const previous = currentStyleId();
    applyMascotStyle(next.id);
    profile = { ...profile, mascotStyle: next.id };
    paintChoices();
    paintSummary();
    try {
      profile = await ctx.updateProfile({ mascotStyle: next.id });
      toast(`Puffy is wearing ${next.label.toLowerCase()}.`, { type: 'info', duration: 2000 });
    } catch (err) {
      console.warn('Could not save Puffy colourway', err);
      profile = { ...profile, mascotStyle: previous };
      applyMascotStyle(previous);
      paintChoices();
      paintSummary();
      toastError('Puffy’s colourway could not be saved.');
    }
  }

  async function chooseAvatar(id) {
    if (id !== 'initials' && id !== 'puffy' && id !== 'pip') return;
    if ((profile.avatarStyle || 'initials') === id) return;
    const previous = profile.avatarStyle || 'initials';
    profile = { ...profile, avatarStyle: id };
    paintChoices();
    try {
      profile = await ctx.updateProfile({ avatarStyle: id });
      toast(id === 'puffy' || id === 'pip' ? 'Puffy is now your mark.' : 'Initials are back.', { type: 'info', duration: 1800 });
    } catch (err) {
      console.warn('Could not save avatar style', err);
      profile = { ...profile, avatarStyle: previous };
      paintChoices();
      toastError('That avatar could not be saved.');
    }
  }

  async function toggleAi(event) {
    const input = event.target.closest('[data-ai-toggle]');
    if (!input) return;
    const next = input.checked;
    try {
      profile = await ctx.updateProfile({ aiOn: next });
      const note = root.querySelector('[data-ai-note]');
      if (note) note.textContent = aiNote(next);
      toast(next ? 'AI help is on for when a backend arrives.' : 'AI help is off. Local rules only.', {
        type: 'info',
        duration: 2400,
      });
    } catch (err) {
      console.warn('Could not save AI preference', err);
      input.checked = !next;
      toastError('That preference did not save.');
    }
  }

  async function toggleNudge(event) {
    const input = event.target.closest('[data-notify-toggle]');
    if (!input) return;
    const key = input.dataset.notifyToggle;
    const next = input.checked;
    try {
      profile = await ctx.updateProfile({ [key]: next });
      toast(next ? 'Nudge on.' : 'Nudge off. That line stays quiet.', {
        type: 'info',
        duration: 2000,
      });
    } catch (err) {
      console.warn('Could not save reminder preference', err);
      input.checked = !next;
      toastError('That preference did not save.');
    }
  }

  async function saveRemindWindow(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const field = form.elements.remindDaysBefore;
    const error = root.querySelector('[data-remind-error]');
    const raw = Number(field.value);
    if (!Number.isFinite(raw) || raw < 0 || raw > 30) {
      error.textContent = 'Choose a window between 0 and 30 days.';
      field.focus();
      return;
    }
    error.textContent = '';
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    submit.setAttribute('aria-busy', 'true');
    try {
      const days = Math.round(raw);
      profile = await ctx.updateProfile({ remindDaysBefore: days });
      field.value = days;
      toast(
        days === 0 ? 'Bills will remind you on the day.' : `Bills will remind you ${days} day${days === 1 ? '' : 's'} ahead.`
      );
    } catch (err) {
      console.warn('Could not save the reminder window', err);
      toastError('That window did not save. Try once more.');
    } finally {
      submit.disabled = false;
      submit.removeAttribute('aria-busy');
    }
  }

  /* ---- Export ------------------------------------------------------------ */

  async function ensureExportData() {
    if (!exportCache) exportCache = await getExportData();
    return exportCache;
  }

  async function exportDataset(kind, button) {
    if (button) {
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
    }
    try {
      const data = await ensureExportData();
      const { csv, count, noun } = buildExport(kind, data);
      downloadCSV(`puffy-${kind}-${todayISO()}.csv`, csv);
      toast(`Exported ${count} ${noun} as CSV.`);
    } catch (err) {
      console.warn('Export failed', err);
      toastError('The export could not be built. Try again in a moment.');
    } finally {
      if (button) {
        button.disabled = false;
        button.removeAttribute('aria-busy');
      }
    }
  }

  function openExportSheet() {
    const body = `
      <div class="export-list">
        ${DATASETS.map((d) => {
          const count = dataCounts[d.id];
          return `<button class="export-row" type="button" data-export-kind="${d.id}">
            <span class="export-row__icon tone tone--${d.id === 'all' ? 'accent' : 'sage'}" aria-hidden="true">${icon(d.icon, 18)}</span>
            <span class="export-row__text">
              <strong>${d.label}</strong>
              <small>${d.note}</small>
            </span>
            <span class="export-row__count">${count ?? '—'} ${d.id === 'all' ? 'records' : 'rows'}</span>
            ${icon('download', 16, 'export-row__go')}
          </button>`;
        }).join('')}
      </div>
      <p class="settings-hint">Files are built on this device. Formula-looking text is escaped so a spreadsheet opens it safely.</p>`;

    const sheet = openSheet({
      eyebrow: 'Portable by design',
      title: 'Take your data with you',
      subtitle: 'A plain CSV, one table at a time — or the whole desk in one file.',
      body,
      footer: `<button class="btn btn--ghost" type="button" data-close-sheet>Close</button>`,
    });

    sheet.footer.querySelector('[data-close-sheet]')?.addEventListener('click', sheet.close);
    sheet.body.querySelectorAll('[data-export-kind]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const kind = btn.dataset.exportKind;
        sheet.close();
        await exportDataset(kind, root.querySelector('[data-export]'));
      });
    });
  }

  /* ---- Install ----------------------------------------------------------- */

  async function handleInstall() {
    if (isStandalone()) return;
    const prompt = window.__plaInstallPrompt;
    if (!prompt) {
      openInstallHelp();
      return;
    }
    const btn = root.querySelector('[data-install]');
    if (btn) btn.disabled = true;
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      window.__plaInstallPrompt = null;
      if (choice?.outcome === 'dismissed') {
        toast('No problem — the browser menu can install it later.', { type: 'info' });
      }
    } catch (err) {
      console.warn('Install prompt failed', err);
      toast('The install prompt could not open. Try the browser menu instead.', { type: 'error' });
    } finally {
      paintInstall();
    }
  }

  function openInstallHelp() {
    const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const steps = ios
      ? [
          'Open Puffy in Safari.',
          'Tap the <strong>Share</strong> button in the toolbar.',
          'Choose <strong>Add to Home Screen</strong>, then Add.',
        ]
      : [
          'Open Puffy in Chrome or Edge.',
          'Open the browser menu — the three dots or the install icon in the address bar.',
          'Choose <strong>Install Puffy</strong> or <strong>Add to Home screen</strong>.',
        ];
    openSheet({
      eyebrow: 'Home screen',
      title: 'A place for Puffy',
      subtitle: 'Installed, Puffy opens without the address bar and works offline.',
      body: `
        <div class="install-hero">${pip({ mood: 'happy', size: 92 })}</div>
        <ol class="install-steps">${steps.map((s) => `<li>${s}</li>`).join('')}</ol>
        <div class="settings-note">
          ${icon('info', 15)}
          <p>If the install option is missing, make sure Puffy is served over <strong>HTTPS</strong> or on <strong>localhost</strong>. Reload once after the first visit.</p>
        </div>`,
      footer: `<button class="btn btn--primary" type="button" data-close-sheet>Got it</button>`,
    }).footer.querySelector('[data-close-sheet]')?.addEventListener('click', (event) => {
      event.currentTarget.closest('dialog')?.close();
    });
  }

  /* ---- Reset ------------------------------------------------------------- */

  async function resetDemo() {
    const ok = await confirmSheet({
      title: 'Reset the demo week?',
      message:
        'Tasks, bills, expenses, habits, goals and history return to Maya’s fresh demo week. Your name, palette, hours and avatar stay exactly as they are.',
      confirmLabel: 'Reset demo data',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await resetDemoData();
      exportCache = null;
      profile = await ctx.reloadProfile();
      toast('A fresh demo week is ready. Have a look around.');
      ctx.navigate('dashboard');
    } catch (err) {
      console.warn('Could not reset demo data', err);
      toastError('The demo could not be reset. Try reloading the page first.');
    }
  }

  /* ---- Events ------------------------------------------------------------ */

  const onClick = (event) => {
    const target = event.target.closest('button, [data-export]');
    if (!target || !root.contains(target)) return;

    if (target.matches('[data-accent-choice]')) return chooseAccent(target.dataset.accentChoice);
    if (target.matches('[data-theme-choice]')) return chooseTheme(target.dataset.themeChoice);
    if (target.matches('[data-puffy-form-choice], [data-pip-form-choice]')) return chooseForm((target.dataset.puffyFormChoice || target.dataset.pipFormChoice));
    if (target.matches('[data-mascot-choice]')) return chooseMascot(target.dataset.mascotChoice);
    if (target.matches('[data-avatar-style]')) return chooseAvatar(target.dataset.avatarStyle);
    if (target.matches('[data-export]')) return openExportSheet();
    if (target.matches('[data-export-quick]')) return exportDataset(target.dataset.exportQuick, target);
    if (target.matches('[data-install]')) return handleInstall();
    if (target.matches('[data-reset]')) return resetDemo();
    if (target.matches('[data-hours-defaults]')) {
      const form = root.querySelector('[data-hours-form]');
      if (form) {
        form.elements.workStart.value = '09:00';
        form.elements.workEnd.value = '17:30';
        const error = root.querySelector('[data-hours-error]');
        if (error) error.textContent = '';
      }
      return undefined;
    }
    return undefined;
  };

  const onChange = (event) => {
    if (event.target.matches('[data-ai-toggle]')) toggleAi(event);
    if (event.target.matches('[data-notify-toggle]')) toggleNudge(event);
  };

  const onInstallable = () => paintInstall();
  const onInstalled = () => paintInstall();

  async function paintSwStatus() {
    const el = root.querySelector('[data-sw-status]');
    if (!el) return;
    if (!('serviceWorker' in navigator)) {
      el.textContent = 'Offline shell: not supported in this browser';
      return;
    }
    const status = await getPwaStatus();
    if (!el.isConnected) return;
    if (!status) {
      el.textContent = 'Offline shell: worker not active yet';
      return;
    }
    const bits = ['Offline shell ready'];
    bits.push(status.chartCached ? 'Chart.js cached' : 'Chart.js loads online');
    el.textContent = bits.join(' · ');
    el.title = `${status.version || 'Puffy'} · ${status.pending || 0} local change(s) queued · ${status.caches?.length || 0} cache(s) on this device`;
  }

  root.addEventListener('click', onClick);
  root.addEventListener('change', onChange);
  root.querySelector('[data-profile-form]')?.addEventListener('submit', saveProfile);
  root.querySelector('[data-hours-form]')?.addEventListener('submit', saveHours);
  root.querySelector('[data-remind-form]')?.addEventListener('submit', saveRemindWindow);
  document.addEventListener('pla:installable', onInstallable);
  window.addEventListener('appinstalled', onInstalled);
  paintSwStatus();

  return {
    destroy() {
      root.removeEventListener('click', onClick);
      root.removeEventListener('change', onChange);
      document.removeEventListener('pla:installable', onInstallable);
      window.removeEventListener('appinstalled', onInstalled);
    },
  };
}
