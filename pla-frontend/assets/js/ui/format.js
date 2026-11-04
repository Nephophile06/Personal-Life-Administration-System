/** Formatting helpers shared by every page. Dates use local YYYY-MM-DD keys. */

const CURRENCY = 'USD';

export const money = (n, { cents = true } = {}) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: CURRENCY,
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  }).format(Number(n) || 0);

export const compactMoney = (n) => {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 10000) return `$${(v / 1000).toFixed(1).replace('.0', '')}k`;
  return money(v, { cents: false });
};

export const num = (n, digits = 0) =>
  new Intl.NumberFormat('en-US', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(Number(n) || 0);

export const pct = (n) => `${Math.round(Number(n) || 0)}%`;

export function parseISO(iso) {
  if (!iso) return null;
  if (iso instanceof Date) return iso;
  const [y, m, d] = iso.split('T')[0].split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function isoDate(date = new Date()) {
  const d = new Date(date);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export const todayISO = () => isoDate(new Date());

export function addDays(iso, days) {
  const d = parseISO(iso) || new Date();
  d.setDate(d.getDate() + days);
  return isoDate(d);
}

export function diffDays(fromISO, toISO) {
  const a = parseISO(fromISO);
  const b = parseISO(toISO);
  if (!a || !b) return 0;
  return Math.round((b - a) / 86400000);
}

export function startOfWeek(iso = todayISO()) {
  const d = parseISO(iso);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day);
  return isoDate(d);
}

export function weekDays(iso = todayISO()) {
  const start = startOfWeek(iso);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function monthKey(date = new Date()) {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(key, { long = true } = {}) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', {
    month: long ? 'long' : 'short',
    year: 'numeric',
  });
}

export function shiftMonth(key, delta) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return monthKey(d);
}

export function monthRange(key) {
  const [y, m] = key.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const last = new Date(y, m, 0);
  return { start: isoDate(first), end: isoDate(last), days: last.getDate() };
}

export function formatDate(value, style = 'medium') {
  const d = parseISO(value);
  if (!d) return '';
  const opts = {
    short: { month: 'short', day: 'numeric' },
    medium: { month: 'short', day: 'numeric', year: 'numeric' },
    long: { weekday: 'long', month: 'long', day: 'numeric' },
    weekday: { weekday: 'short' },
    'weekday-long': { weekday: 'long' },
    day: { day: 'numeric' },
    month: { month: 'long' },
    'month-short': { month: 'short' },
    time: { hour: 'numeric', minute: '2-digit' },
  }[style] || {};
  return d.toLocaleDateString('en-US', opts);
}

export function formatTime(d) {
  const date = d instanceof Date ? d : parseISO(d);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function minutesLabel(mins) {
  const m = Math.max(0, Math.round(Number(mins) || 0));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h}h ${rest}m` : `${h}h`;
}

export function timeFromMinutes(total) {
  const t = ((Math.round(total) % 1440) + 1440) % 1440;
  const h = Math.floor(t / 60);
  const m = t % 60;
  const suffix = h >= 12 ? 'pm' : 'am';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, '0')}${suffix}`;
}

export function timeToMinutes(str) {
  const [h, m] = String(str).split(':').map(Number);
  return h * 60 + (m || 0);
}

export function relativeDue(dueISO, refISO = todayISO()) {
  if (!dueISO) return { label: 'No deadline', tone: 'none', days: null };
  const days = diffDays(refISO, dueISO);
  if (days < 0) {
    return {
      label: days === -1 ? 'Yesterday' : `${Math.abs(days)} days overdue`,
      tone: 'overdue',
      days,
    };
  }
  if (days === 0) return { label: 'Today', tone: 'today', days };
  if (days === 1) return { label: 'Tomorrow', tone: 'soon', days };
  if (days <= 6) return { label: `In ${days} days`, tone: 'soon', days };
  return { label: formatDate(dueISO, 'short'), tone: 'later', days };
}

export function relativeTime(ts) {
  const then = new Date(ts).getTime();
  const now = Date.now();
  const mins = Math.round((now - then) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function initials(name = '') {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() || '')
      .join('') || 'P'
  );
}

export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h >= 5 && h < 12) {
    return {
      period: 'morning',
      hello: 'Good morning',
      line: 'A fresh page. Let’s keep it light.',
    };
  }
  if (h >= 12 && h < 17) {
    return {
      period: 'afternoon',
      hello: 'Good afternoon',
      line: 'The middle of the day — one thing at a time.',
    };
  }
  if (h >= 17 && h < 22) {
    return {
      period: 'evening',
      hello: 'Good evening',
      line: 'Winding down. The list can wait a moment.',
    };
  }
  return {
    period: 'night',
    hello: 'Still up',
    line: 'Keep it gentle — rest is part of the plan.',
  };
}

export const esc = (str = '') =>
  String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[c]);

export function debounce(fn, wait = 200) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

export const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

export function weekdayShort(iso) {
  return formatDate(iso, 'weekday');
}

export function uid() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}
