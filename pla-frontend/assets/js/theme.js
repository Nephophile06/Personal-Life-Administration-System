/**
 * Theme + accent persistence.
 * The <html> attributes are set by an inline boot script before paint; this
 * module keeps them in sync and broadcasts changes to the shell.
 */

const THEME_KEY = 'pla.theme';
const ACCENT_KEY = 'pla.accent';

export const ACCENTS = [
  { id: 'terracotta', label: 'Terracotta', hex: '#b4552d' },
  { id: 'sage', label: 'Sage', hex: '#5c7052' },
  { id: 'ochre', label: 'Ochre', hex: '#a2762a' },
  { id: 'rose', label: 'Clay rose', hex: '#a1524f' },
  { id: 'indigo', label: 'Harbour', hex: '#4a6474' },
];

const mql = typeof window !== 'undefined' && window.matchMedia
  ? window.matchMedia('(prefers-color-scheme: dark)')
  : null;

const listeners = new Set();

export function getThemePref() {
  const stored = localStorage.getItem(THEME_KEY);
  return ['light', 'dark', 'auto'].includes(stored) ? stored : 'auto';
}

export function getTheme() {
  const pref = getThemePref();
  if (pref === 'auto') return mql && mql.matches ? 'dark' : 'light';
  return pref;
}

export function getAccent() {
  const stored = localStorage.getItem(ACCENT_KEY);
  return ACCENTS.some((a) => a.id === stored) ? stored : 'terracotta';
}

export function applyTheme(pref = getThemePref(), { persist = true } = {}) {
  const theme = pref === 'auto' ? (mql && mql.matches ? 'dark' : 'light') : pref;
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.themePref = pref;
  if (persist) localStorage.setItem(THEME_KEY, pref);

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#15120d' : '#f2eadd');

  listeners.forEach((fn) => fn({ theme, pref }));
  return theme;
}

export function applyAccent(id = getAccent()) {
  document.documentElement.dataset.accent = id;
  localStorage.setItem(ACCENT_KEY, id);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', getTheme() === 'dark' ? '#15120d' : '#f2eadd');
  listeners.forEach((fn) => fn({ accent: id }));
  return id;
}

export function cycleTheme() {
  const pref = getThemePref();
  const next = pref === 'auto' ? 'light' : pref === 'light' ? 'dark' : 'auto';
  applyTheme(next);
  return next;
}

export function onThemeChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function initTheme() {
  applyTheme(getThemePref(), { persist: false });
  applyAccent(getAccent());
  if (mql) {
    const onChange = () => {
      if (getThemePref() === 'auto') applyTheme('auto', { persist: false });
    };
    if (mql.addEventListener) mql.addEventListener('change', onChange);
    else if (mql.addListener) mql.addListener(onChange);
  }
}

export const THEME_LABEL = { light: 'Light', dark: 'Dark', auto: 'Auto' };
