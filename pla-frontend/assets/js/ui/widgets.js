import { clamp, esc } from './format.js';

/** SVG ring. Percentage 0–100. */
export function ring({
  value = 0,
  size = 92,
  stroke = 7,
  label = '',
  sub = '',
  level = '',
  labelClass = '',
} = {}) {
  const v = clamp(Number(value) || 0, 0, 100);
  const r = 44;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - v / 100);
  return `
    <div class="ring-wrap" style="--ring-size:${size}px;--ring-width:${stroke}px">
      <svg class="ring" viewBox="0 0 100 100" aria-hidden="true">
        <circle class="ring__track" cx="50" cy="50" r="${r}"/>
        <circle class="ring__value ${level ? `ring__value--${level}` : ''}" cx="50" cy="50" r="${r}"
          stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}"
          data-target-offset="${offset.toFixed(2)}"/>
      </svg>
      <div class="ring__center ${labelClass}">
        <span class="ring__num">${label}</span>
        ${sub ? `<span class="ring__sub">${sub}</span>` : ''}
      </div>
    </div>`;
}

export function bar(value, { level = '', tall = false, thin = false, label = 'Progress' } = {}) {
  const v = clamp(Number(value) || 0, 0, 100).toFixed(1);
  return `<div class="bar ${tall ? 'bar--tall' : ''} ${thin ? 'bar--thin' : ''}" role="progressbar" aria-label="${esc(label)}" aria-valuenow="${Math.round(v)}" aria-valuemin="0" aria-valuemax="100">
    <div class="bar__fill" ${level ? `data-level="${level}"` : ''} style="--p:${v}"></div>
  </div>`;
}

/* ---- Mood faces ---------------------------------------------------------- */

const MOODS = [
  { level: 1, key: 'rough', label: 'Rough' },
  { level: 2, key: 'low', label: 'Low' },
  { level: 3, key: 'okay', label: 'Okay' },
  { level: 4, key: 'good', label: 'Good' },
  { level: 5, key: 'great', label: 'Great' },
];

const MOUTHS = {
  1: '<path d="M11 21.5c2.8-3 7.2-3 10 0"/>',
  2: '<path d="M11.4 20.8c2.6-2 6.6-2 9.2 0"/>',
  3: '<path d="M11.5 20.6h9"/>',
  4: '<path d="M11 19c2.8 3.2 7.2 3.2 10 0"/>',
  5: '<path d="M10.6 18.6c3 4.4 7.8 4.4 10.8 0z" fill="currentColor" stroke="none"/>',
};

const EYES = {
  1: '<path d="M10 13.2 14 15M22 13.2 18 15"/><path d="M11.2 17.8c.7 1 1.8 1 2.5 0M18.3 17.8c.7 1 1.8 1 2.5 0"/>',
  2: '<path d="M8.8 13.6 13 15M23.2 13.6 19 15"/><circle cx="11.8" cy="16.8" r=".9" fill="currentColor" stroke="none"/><circle cx="20.2" cy="16.8" r=".9" fill="currentColor" stroke="none"/>',
  3: '<circle cx="11.8" cy="16.6" r="1" fill="currentColor" stroke="none"/><circle cx="20.2" cy="16.6" r="1" fill="currentColor" stroke="none"/>',
  4: '<circle cx="11.8" cy="16.4" r="1" fill="currentColor" stroke="none"/><circle cx="20.2" cy="16.4" r="1" fill="currentColor" stroke="none"/>',
  5: '<path d="M9.2 17c1.6-1.8 3.8-1.8 5.4 0M17.4 17c1.6-1.8 3.8-1.8 5.4 0"/>',
};

export function moodFace(level = 3, size = 30) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
    <circle cx="16" cy="16" r="13"/>
    ${EYES[level] || EYES[3]}
    ${MOUTHS[level] || MOUTHS[3]}
  </svg>`;
}

export function moodPicker(selected = null, { withLabels = true, name = 'mood', attr = 'data-mood' } = {}) {
  return `<div class="moods" role="group" aria-label="How are you feeling?">
    ${MOODS.map(
      (m) => `<div class="mood-choice">
        <button type="button" class="mood" ${attr}="${m.level}" aria-pressed="${selected === m.level}" aria-label="${m.label}" title="${m.label}">
          ${moodFace(m.level)}
        </button>
        ${withLabels ? `<span class="mood-label">${m.label}</span>` : ''}
      </div>`
    ).join('')}
  </div>`;
}

export const moodMeta = (level) =>
  MOODS.find((m) => m.level === Number(level)) || { level: 0, key: 'none', label: 'Not checked in' };

/* ---- Page furniture ------------------------------------------------------ */

export function pageHead({ eyebrow = '', title, sub = '', actions = '', className = '' }) {
  return `<header class="page-head ${className}">
    <div class="page-head__text">
      ${eyebrow ? `<span class="eyebrow">${eyebrow}</span>` : ''}
      <h1>${title}</h1>
      ${sub ? `<p class="page-head__sub">${sub}</p>` : ''}
    </div>
    ${actions ? `<div class="page-head__actions">${actions}</div>` : ''}
  </header>`;
}

export function sectionHead({ title, link = '', href = '', note = '' }) {
  return `<div class="section-head">
    <h2>${title}${note ? ` <span class="muted tiny" style="font-family:var(--font-body);letter-spacing:0">${note}</span>` : ''}</h2>
    ${link ? `<a class="section-head__link" href="${href}">${link}</a>` : ''}
  </div>`;
}

export function emptyState({ illustration = '', title, text = '', action = '' }) {
  return `<div class="empty">
    ${illustration ? `<div class="empty__art">${illustration}</div>` : ''}
    <h3>${esc(title)}</h3>
    ${text ? `<p>${text}</p>` : ''}
    ${action}
  </div>`;
}

/** Tick a number up without ever touching reduced-motion users. */
export function countTo(el, target, { duration = 900, decimals = 0, prefix = '', suffix = '' } = {}) {
  if (!el) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fmt = (n) =>
    `${prefix}${n.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}${suffix}`;
  if (reduce) {
    el.textContent = fmt(Number(target) || 0);
    return;
  }
  const start = performance.now();
  const from = 0;
  const to = Number(target) || 0;
  const tick = (now) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = fmt(from + (to - from) * eased);
    if (t < 1) requestAnimationFrame(tick);
    else el.textContent = fmt(to);
  };
  requestAnimationFrame(tick);
}

/** Animate a ring from empty to its target once inserted. */
export function hydrateRings(root = document) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  requestAnimationFrame(() => {
    root.querySelectorAll('.ring__value').forEach((circle) => {
      const target = circle.dataset.targetOffset;
      if (!target) return;
      const d = circle.getAttribute('stroke-dashoffset');
      circle.setAttribute('stroke-dashoffset', circle.getAttribute('stroke-dasharray'));
      requestAnimationFrame(() => {
        circle.setAttribute('stroke-dashoffset', target);
      });
      // keep the DOM honest if the transition is skipped
      setTimeout(() => circle.setAttribute('stroke-dashoffset', d), 1200);
    });
  });
}

export function avatar(name = '', size = '') {
  const init = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('');
  return `<span class="avatar ${size}" aria-hidden="true">${esc(init || 'P')}</span>`;
}

export const SEG = (items, active) =>
  items
    .map(
      (item) =>
        `<button type="button" data-seg="${item.value}" aria-selected="${item.value === active}">${item.label}</button>`
    )
    .join('');
