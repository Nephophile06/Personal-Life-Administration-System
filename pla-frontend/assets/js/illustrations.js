/**
 * Original paper-cut illustrations. Flat fills, ink outlines, no gradients.
 * Sized with viewBoxes so they scale inside empty states.
 */
import { pip } from './mascot.js';

const INK = '#3a2a1d';
const CREAM = '#fbf4e6';
const CREAM_DEEP = '#f0e4d0';
const TERRA = '#c9673f';
const TERRA_DEEP = '#a94e2b';
const SAGE = '#7e9470';
const SAGE_DARK = '#556a4b';
const OCHRE = '#bf9440';

const frame = (inner, vb = '0 0 240 200', label = '') =>
  `<svg viewBox="${vb}" fill="none" xmlns="http://www.w3.org/2000/svg" ${label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"'} focusable="false">${inner}</svg>`;

const sun = (x, y, r = 15) => `
  <g stroke="${OCHRE}" stroke-width="1.8" stroke-linecap="round">
    <circle cx="${x}" cy="${y}" r="${r}" fill="#f3d9a2"/>
    ${Array.from({ length: 8 }, (_, i) => {
      const a = (i * Math.PI) / 4;
      const x1 = x + Math.cos(a) * (r + 6);
      const y1 = y + Math.sin(a) * (r + 6);
      const x2 = x + Math.cos(a) * (r + 11);
      const y2 = y + Math.sin(a) * (r + 11);
      return `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}"/>`;
    }).join('')}
  </g>`;

const sprinkle = `
  <g fill="${TERRA}" opacity=".55">
    <circle cx="54" cy="42" r="2.4"/><circle cx="186" cy="64" r="1.8"/>
    <circle cx="202" cy="36" r="2.2"/><circle cx="36" cy="86" r="1.6"/>
  </g>`;

export function seedScene() {
  return frame(`
    <ellipse cx="120" cy="180" rx="82" ry="9" fill="${INK}" opacity=".1"/>
    ${sun(196, 44, 13)}
    ${sprinkle}
    <path d="M26 144c0-9 5-14 14-15l80-10v56l-80 10c-9 1-14-4-14-13z" fill="${CREAM}" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M214 144c0-9-5-14-14-15l-80-10v56l80 10c9 1 14-4 14-13z" fill="${CREAM}" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M120 119v56" stroke="${INK}" stroke-width="2.4"/>
    <path d="M120 119c-2-24 2-46 10-64" stroke="${SAGE_DARK}" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M129 62c-13-1-22-9-23-21 13-1 22 7 23 21Z" fill="${SAGE}" stroke="${SAGE_DARK}" stroke-width="2"/>
    <path d="M131 54c2-12 11-19 22-17-1 12-9 18-22 17Z" fill="#93a784" stroke="${SAGE_DARK}" stroke-width="2"/>
    <g stroke="${OCHRE}" stroke-width="1.2" opacity=".55" stroke-linecap="round">
      <path d="M48 142h54M48 152h54M48 162h40M138 142h54M138 152h54M138 162h40"/>
    </g>
    <circle cx="74" cy="128" r="7.5" fill="none" stroke="${TERRA}" stroke-width="2" stroke-dasharray="3 3"/>
    <path d="M70.5 128l2.6 2.6 4.6-5" stroke="${TERRA}" stroke-width="2" stroke-linecap="round"/>
    <path d="M150 128h26" stroke="${INK}" stroke-width="2" stroke-linecap="round" opacity=".3"/>
    <path d="M150 134h16" stroke="${INK}" stroke-width="2" stroke-linecap="round" opacity=".2"/>
  `);
}

export function emptyTasks() {
  return frame(`
    <ellipse cx="120" cy="176" rx="72" ry="8" fill="${INK}" opacity=".09"/>
    <rect x="66" y="28" width="108" height="142" rx="8" fill="${CREAM}" stroke="${INK}" stroke-width="2.4" transform="rotate(-4 120 99)"/>
    <rect x="58" y="34" width="108" height="142" rx="8" fill="${CREAM_DEEP}" stroke="${INK}" stroke-width="2.4"/>
    <g stroke="${OCHRE}" stroke-width="1.2" opacity=".5" stroke-linecap="round">
      <path d="M76 64h72M76 82h72M76 100h72M76 118h72M76 136h52"/>
    </g>
    <rect x="74" y="56" width="12" height="12" rx="3" fill="none" stroke="${TERRA}" stroke-width="2"/>
    <path d="M77 62l3 3 5-6" stroke="${TERRA}" stroke-width="2" stroke-linecap="round" fill="none"/>
    <rect x="74" y="74" width="12" height="12" rx="3" fill="none" stroke="${INK}" stroke-width="1.6" opacity=".4"/>
    ${sun(190, 40, 11)}
    <path d="M168 148c18-6 26-18 28-36" stroke="${SAGE_DARK}" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M193 117c-10-1-17-7-18-17 10-1 17 6 18 17Z" fill="${SAGE}" stroke="${SAGE_DARK}" stroke-width="1.8"/>
    <path d="M195 111c1-9 8-14 17-13-1 9-7 14-17 13Z" fill="#93a784" stroke="${SAGE_DARK}" stroke-width="1.8"/>
  `);
}

export function emptyBills() {
  return frame(`
    <ellipse cx="120" cy="178" rx="66" ry="8" fill="${INK}" opacity=".09"/>
    <path d="M82 22h76l-4 154-11-8-10 8-10-8-10 8-10-8-10 8-7-8z" fill="${CREAM}" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round" transform="rotate(3 120 100)"/>
    <path d="M96 44h48M96 58h32" stroke="${INK}" stroke-width="1.8" opacity=".35" stroke-linecap="round"/>
    <path d="M96 76h48M96 88h48M96 100h30" stroke="${OCHRE}" stroke-width="1.2" opacity=".6" stroke-linecap="round"/>
    <circle cx="158" cy="142" r="24" fill="#f3d9a2" stroke="${INK}" stroke-width="2.2"/>
    <circle cx="158" cy="142" r="18" fill="none" stroke="${OCHRE}" stroke-width="1.4" stroke-dasharray="2 3"/>
    <path d="M158 132v20M153 137h8a4 4 0 0 1 0 8h-6a4 4 0 0 0 0 8h9" stroke="${TERRA_DEEP}" stroke-width="2" stroke-linecap="round" fill="none"/>
    ${sun(50, 44, 11)}
    <path d="M48 130c-6 8-6 15 0 18 6-3 6-10 0-18Z" fill="${SAGE}" stroke="${SAGE_DARK}" stroke-width="1.8"/>
  `);
}

export function emptyExpenses() {
  return frame(`
    <ellipse cx="120" cy="178" rx="70" ry="8" fill="${INK}" opacity=".09"/>
    <path d="M74 72h92v88c0 12-9 20-22 20H96c-13 0-22-8-22-20z" fill="${CREAM}" stroke="${INK}" stroke-width="2.4"/>
    <path d="M74 72h92" stroke="${INK}" stroke-width="2.4"/>
    <path d="M84 60h72" stroke="${INK}" stroke-width="2.4" stroke-linecap="round" opacity=".3"/>
    <g>
      <circle cx="104" cy="126" r="15" fill="#f3d9a2" stroke="${OCHRE}" stroke-width="1.8"/>
      <circle cx="122" cy="138" r="15" fill="#f3d9a2" stroke="${OCHRE}" stroke-width="1.8"/>
      <circle cx="139" cy="122" r="15" fill="#f3d9a2" stroke="${OCHRE}" stroke-width="1.8"/>
      <path d="M104 120v12M99.5 124h7a3 3 0 0 1 0 6h-5a3 3 0 0 0 0 6h7" stroke="${TERRA_DEEP}" stroke-width="1.6" stroke-linecap="round"/>
    </g>
    <path d="M134 70c-1-22 5-38 18-48" stroke="${SAGE_DARK}" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M151 27c-10-2-16-9-16-19 10 0 16 8 16 19Z" fill="${SAGE}" stroke="${SAGE_DARK}" stroke-width="1.8"/>
    <path d="M153 22c2-9 9-14 18-12-1 9-8 14-18 12Z" fill="#93a784" stroke="${SAGE_DARK}" stroke-width="1.8"/>
    ${sprinkle}
  `);
}

export function emptyHabits() {
  return frame(`
    <ellipse cx="120" cy="176" rx="62" ry="8" fill="${INK}" opacity=".09"/>
    <path d="M82 128h76l-8 44H90z" fill="${TERRA}" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M78 128h84" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>
    <path d="M120 128c-2-30 2-52 6-68" stroke="${SAGE_DARK}" stroke-width="2.8" stroke-linecap="round"/>
    <path d="M124 78c-16-2-27-12-28-28 16 0 27 11 28 28Z" fill="${SAGE}" stroke="${SAGE_DARK}" stroke-width="2"/>
    <path d="M126 66c3-16 14-25 30-23-1 16-13 24-30 23Z" fill="#93a784" stroke="${SAGE_DARK}" stroke-width="2"/>
    <path d="M120 98c-12-1-20-8-21-20 12 0 20 8 21 20Z" fill="${SAGE}" stroke="${SAGE_DARK}" stroke-width="1.8" opacity=".8"/>
    ${sun(194, 34, 13)}
    <g stroke="${OCHRE}" stroke-width="1.4" stroke-linecap="round" opacity=".5">
      <path d="M38 60l6 6M44 60l-6 6"/>
      <path d="M204 120h8M208 116v8"/>
    </g>
  `);
}

export function emptyGoals() {
  return frame(`
    <path d="M28 168c24-22 48-30 92-30s68 8 92 30z" fill="${SAGE}" opacity=".25"/>
    <path d="M28 168h184" stroke="${INK}" stroke-width="2" stroke-linecap="round" opacity=".2"/>
    <path d="M120 164V48" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M122 54c18-9 32 6 52 0v38c-20 6-34-9-52 0z" fill="${TERRA}" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>
    <circle cx="120" cy="166" r="4" fill="${INK}"/>
    ${sun(58, 44, 12)}
    <path d="M166 140c8 2 14 8 16 16-11 1-18-5-16-16Z" fill="${SAGE}" stroke="${SAGE_DARK}" stroke-width="1.8"/>
    <g fill="${TERRA}" opacity=".45">
      <circle cx="78" cy="86" r="2.2"/><circle cx="90" cy="116" r="1.6"/>
    </g>
  `);
}

export function emptyNotifications() {
  return frame(`
    <ellipse cx="120" cy="174" rx="58" ry="8" fill="${INK}" opacity=".09"/>
    <path d="M120 48c-19 0-32 14-32 34 0 29-11 37-11 37h86s-11-8-11-37c0-20-13-34-32-34Z" fill="${CREAM}" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M120 48V36" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>
    <circle cx="120" cy="32" r="5" fill="${TERRA}" stroke="${INK}" stroke-width="2"/>
    <path d="M107 123c2 6 6 9 13 9s11-3 13-9" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M151 66l14-8M89 66 75 58" stroke="${OCHRE}" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M152 84h16M72 84H56" stroke="${OCHRE}" stroke-width="1.6" stroke-linecap="round" opacity=".6"/>
    <path d="M164 120l3 6 6 3-6 3-3 6-3-6-6-3 6-3z" fill="${OCHRE}" opacity=".65"/>
  `);
}

export function achievement() {
  return frame(`
    <ellipse cx="120" cy="184" rx="66" ry="8" fill="${INK}" opacity=".1"/>
    <path d="M56 168c-16-22-14-50 6-68 3 18 10 32 24 42" stroke="${SAGE_DARK}" stroke-width="2.6" stroke-linecap="round" fill="none"/>
    <path d="M48 140c-10-2-16-9-16-20 10 0 17 7 17 18Z" fill="${SAGE}" stroke="${SAGE_DARK}" stroke-width="2"/>
    <path d="M56 118c-9-4-13-13-10-23 9 3 13 11 12 21Z" fill="#93a784" stroke="${SAGE_DARK}" stroke-width="2"/>
    <path d="M184 168c16-22 14-50-6-68-3 18-10 32-24 42" stroke="${SAGE_DARK}" stroke-width="2.6" stroke-linecap="round" fill="none"/>
    <path d="M192 140c10-2 16-9 16-20-10 0-17 7-17 18Z" fill="${SAGE}" stroke="${SAGE_DARK}" stroke-width="2"/>
    <path d="M184 118c9-4 13-13 10-23-9 3-13 11-12 21Z" fill="#93a784" stroke="${SAGE_DARK}" stroke-width="2"/>
    <g transform="translate(52 26)">${pip({ mood: 'celebrating', size: 138 })}</g>
    <g fill="${OCHRE}">
      <circle cx="52" cy="58" r="2.6"/><circle cx="196" cy="82" r="2"/><circle cx="78" cy="28" r="1.6"/>
    </g>
  `, '0 0 240 210');
}

const SKY = {
  morning: { sky: '#f6e3bd', sun: '#f0c675', hill: '#a8b394', hill2: '#c4c9a7' },
  afternoon: { sky: '#f5e6c8', sun: '#e8b25e', hill: '#9daf8b', hill2: '#bfc7a2' },
  evening: { sky: '#ecd0bb', sun: '#cf8259', hill: '#8d9a80', hill2: '#b0ad91' },
  night: { sky: '#5d6470', sun: '#efe3c4', hill: '#4c574e', hill2: '#626c5d' },
};

/** Arch-window scene behind the dashboard greeting. */
export function welcomeScene(period = 'evening', { compact = false } = {}) {
  const p = SKY[period] || SKY.evening;
  const night = period === 'night';
  const sunY = period === 'morning' ? 64 : period === 'afternoon' ? 54 : period === 'evening' ? 96 : 58;
  const sunX = period === 'evening' ? 176 : 150;
  return frame(
    `
    <path d="M22 196V84C22 42 60 14 110 14s88 28 88 70v112z" fill="${CREAM}" stroke="${INK}" stroke-width="3"/>
    <path d="M36 182V84c0-32 31-54 74-54s74 22 74 54v98z" fill="${p.sky}"/>
    ${
      night
        ? `<g fill="#f3e6c6"><circle cx="66" cy="58" r="2"/><circle cx="150" cy="44" r="1.6"/><circle cx="176" cy="86" r="1.4"/><circle cx="120" cy="36" r="1.2"/><path d="M84 76l1.6 4 4 1.6-4 1.6-1.6 4-1.6-4-4-1.6 4-1.6z" opacity=".8"/></g>
           <circle cx="${sunX}" cy="${sunY}" r="16" fill="${p.sun}" stroke="#e7d6ac" stroke-width="1.5"/>`
        : `<circle cx="${sunX}" cy="${sunY}" r="19" fill="${p.sun}" opacity=".9"/>
           <circle cx="${sunX}" cy="${sunY}" r="26" fill="none" stroke="${p.sun}" stroke-width="1" opacity=".5"/>`
    }
    <path d="M36 140c26-16 44-6 64 2 26 10 50-6 84-6v44H36z" fill="${p.hill2}" opacity=".9"/>
    <path d="M36 158c34-14 56 4 84 4 26 0 44-10 64-4v24H36z" fill="${p.hill}"/>
    <path d="M36 182h148" stroke="${INK}" stroke-width="3"/>
    <rect x="28" y="178" width="164" height="12" rx="3" fill="${CREAM_DEEP}" stroke="${INK}" stroke-width="2.6"/>
    <g transform="translate(46 70)">${pip({ mood: night ? 'sleepy' : 'happy', size: compact ? 108 : 116 })}</g>
    <path d="M161 172v-20c0-3 2-5 5-5h14c3 0 5 2 5 5v20" fill="${TERRA}" stroke="${INK}" stroke-width="2.2"/>
    <path d="M175 147c0-6 4-10 10-10" stroke="${SAGE_DARK}" stroke-width="2" stroke-linecap="round"/>
    <path d="M185 136c6-1 10-5 10-10-6 0-10 4-10 10Z" fill="${SAGE}" stroke="${SAGE_DARK}" stroke-width="1.6"/>
    <g stroke="${INK}" stroke-width="1.6" opacity=".35">
      <path d="M26 46h-8M30 30l-6-6M44 20l-3-8"/>
    </g>
  `,
    '0 0 220 200',
    'Pip at a window'
  );
}
