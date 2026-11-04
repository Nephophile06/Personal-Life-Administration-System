/**
 * Hand-built icon set — 24px grid, 1.6 stroke, round joins.
 * Everything is inline SVG so icons inherit currentColor and stay crisp.
 */

const P = {
  home: '<path d="M4 10.4 12 3.8l8 6.6V20a1 1 0 0 1-1 1h-4.6v-6.2H9.6V21H5a1 1 0 0 1-1-1z"/>',
  tasks:
    '<rect x="3.4" y="4.4" width="17.2" height="15.6" rx="3"/><path d="m7.6 12 3 3 5.8-6.2"/>',
  calendar:
    '<rect x="3.4" y="5.2" width="17.2" height="15.4" rx="3"/><path d="M8 2.8v4.4M16 2.8v4.4M3.4 10h17.2M8 14h.01M12 14h.01M16 14h.01M8 17.4h.01M12 17.4h.01"/>',
  receipt:
    '<path d="M6 3.2h12v17.4l-2.2-1.5-2 1.5-1.8-1.5-2 1.5-1.8-1.5-2.2 1.5z"/><path d="M9 8h6M9 11.6h6"/>',
  chart:
    '<path d="M4 3.4v17.2h16.4"/><path d="M8 16.4v-4.2M12 16.4V8.2M16 16.4v-6.6"/>',
  sprout:
    '<path d="M12 21.2v-8.4"/><path d="M12 13.4C12 9.2 8.9 7.4 4.6 7.4c0 4.2 3.1 6 7.4 6Z"/><path d="M12 11.2c0-4.2 3.1-6 7.4-6 0 4.2-3.1 6-7.4 6Z"/>',
  book:
    '<path d="M5.2 4.4A2.6 2.6 0 0 1 7.8 1.8H19v20H7.8a2.6 2.6 0 0 1-2.6-2.6z"/><path d="M5.2 17.4h13.6M9.4 6h5.8M9.4 9.6h5.8"/>',
  bell:
    '<path d="M18.2 9.4a6.2 6.2 0 1 0-12.4 0c0 5-2.2 6.4-2.2 6.4h16.8s-2.2-1.4-2.2-6.4Z"/><path d="M9.8 19.4a2.3 2.3 0 0 0 4.4 0"/>',
  settings:
    '<path d="M3.6 7.2h8.2M16.4 7.2h4M3.6 16.8h3.8M12 16.8h8.4"/><circle cx="14.2" cy="7.2" r="2.4"/><circle cx="9.6" cy="16.8" r="2.4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="10.8" cy="10.8" r="6.6"/><path d="m15.6 15.6 4.6 4.6"/>',
  filter: '<path d="M4 6.4h16M7.2 12h9.6M10.4 17.6h3.2"/>',
  'chevron-down': '<path d="m6.4 9.2 5.6 5.6 5.6-5.6"/>',
  'chevron-up': '<path d="m6.4 14.8 5.6-5.6 5.6 5.6"/>',
  'chevron-left': '<path d="m14.8 6.4-5.6 5.6 5.6 5.6"/>',
  'chevron-right': '<path d="m9.2 6.4 5.6 5.6-5.6 5.6"/>',
  close: '<path d="M6.2 6.2l11.6 11.6M17.8 6.2 6.2 17.8"/>',
  edit: '<path d="M4 20h4L19.2 8.8a2.2 2.2 0 0 0-3.1-3.1L4.8 17z"/><path d="m14.6 7.2 2.2 2.2"/>',
  trash:
    '<path d="M4 6.8h16M9 6.8V4.4h6v2.4M6.4 6.8l1 13.8h9.2l1-13.8M10 11v5.4M14 11v5.4"/>',
  grip:
    '<g fill="currentColor" stroke="none"><circle cx="9" cy="6" r="1.4"/><circle cx="15" cy="6" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="9" cy="18" r="1.4"/><circle cx="15" cy="18" r="1.4"/></g>',
  clock: '<circle cx="12" cy="12" r="8.6"/><path d="M12 7.2v5.2l3.4 2"/>',
  flag: '<path d="M5.4 21.2V3.4"/><path d="M5.4 4.2c4-2.6 7 2 14 0v9c-7 2.6-10-2.6-14 0"/>',
  repeat:
    '<path d="M16.6 2.6 20 6l-3.4 3.4M4 11V9.4a3.4 3.4 0 0 1 3.4-3.4H20M7.4 21.4 4 18l3.4-3.4M20 13v1.6a3.4 3.4 0 0 1-3.4 3.4H4"/>',
  alert: '<path d="M12 3.2 2.4 20.4h19.2z"/><path d="M12 9.2v4.6"/><circle cx="12" cy="17" r=".9" fill="currentColor" stroke="none"/>',
  check: '<path d="m4.8 12.4 4.8 4.8 9.6-10.4"/>',
  'check-circle': '<circle cx="12" cy="12" r="9"/><path d="m8 12.2 2.8 2.8 5.4-5.6"/>',
  'plus-circle': '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
  'x-circle': '<circle cx="12" cy="12" r="9"/><path d="m9.2 9.2 5.6 5.6M14.8 9.2l-5.6 5.6"/>',
  more: '<g fill="currentColor" stroke="none"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></g>',
  download: '<path d="M12 3.4v11.8"/><path d="m7.2 10.4 4.8 4.8 4.8-4.8"/><path d="M4 20.4h16"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4.2 21c0-4.1 3.5-6.6 7.8-6.6s7.8 2.5 7.8 6.6"/>',
  logout:
    '<path d="M14.6 4h3.2a2.2 2.2 0 0 1 2.2 2.2v11.6a2.2 2.2 0 0 1-2.2 2.2h-3.2"/><path d="M9.8 8.2 6 12l3.8 3.8M6 12h9.2"/>',
  sun:
    '<circle cx="12" cy="12" r="4"/><path d="M12 2.2v2.2M12 19.6v2.2M2.2 12h2.2M19.6 12h2.2M5.1 5.1l1.6 1.6M17.3 17.3l1.6 1.6M18.9 5.1l-1.6 1.6M6.7 17.3l-1.6 1.6"/>',
  moon: '<path d="M20.2 14.4A8.6 8.6 0 0 1 9.6 3.8a8.6 8.6 0 1 0 10.6 10.6Z"/>',
  auto: '<path d="M12 3.4v3M12 17.6v3M3.4 12h3M17.6 12h3"/><path d="M18.4 5.6a9 9 0 0 0-12.8 0 9 9 0 0 0 0 12.8 9 9 0 0 0 12.8 0 9 9 0 0 0 0-12.8Z" opacity=".35"/>',
  sparkles:
    '<path d="M12 3.2l1.7 4.9 4.9 1.7-4.9 1.7L12 16.4l-1.7-4.9L5.4 9.8l4.9-1.7z"/><path d="M18.4 15.4l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7zM5.4 16.6l.5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5-1.5-.5 1.5-.5z"/>',
  flame:
    '<path d="M12 21c4.1 0 6.7-2.8 6.7-6.3 0-4.7-4.5-6.6-4.1-12.2-3.3 1.8-5.5 5.1-5.5 7.7 0 1.6.7 2.6.7 2.6s-1.8-1.2-2.8-3.1c-.6 1.8-1.6 3.4-1.6 5.5C5.4 18.4 7.9 21 12 21Z"/><path d="M12 21c1.9 0 3.1-1.3 3.1-2.9 0-2.1-1.8-3-2-5.6-1.5 1.2-2.5 2.7-2.5 4.1 0 1 .4 1.5.4 1.5s-.9-.5-1.3-1.4c-.3.9-.8 1.6-.8 2.5 0 1.4 1.2 1.8 3.1 1.8Z" opacity=".5"/>',
  target: '<circle cx="12" cy="12" r="8.6"/><circle cx="12" cy="12" r="4.8"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/>',
  card: '<rect x="2.6" y="5.4" width="18.8" height="13.2" rx="2.8"/><path d="M2.6 9.6h18.8M6 15.2h4"/>',
  droplet: '<path d="M12 3.2s6 6.4 6 10.1a6 6 0 0 1-12 0c0-3.7 6-10.1 6-10.1Z"/><path d="M9.4 14.6a2.7 2.7 0 0 0 2.6 2.4"/>',
  bolt: '<path d="M13.2 2.4 4.4 14h6.6l-1 7.6L19 10.2h-6.6z"/>',
  house: '<path d="M4.2 9.8 12 3.6l7.8 6.2v9.6a1.4 1.4 0 0 1-1.4 1.4H5.6a1.4 1.4 0 0 1-1.4-1.4z"/><path d="M9.4 20.8v-6h5.2v6"/>',
  cart: '<circle cx="9.2" cy="19.6" r="1.5"/><circle cx="17.2" cy="19.6" r="1.5"/><path d="M3 3.4h2.2l2.5 11.2h10.8L21 7H6"/>',
  car: '<path d="M4 12.4 6 6.2h12l2 6.2"/><rect x="3" y="12.4" width="18" height="5.4" rx="2"/><path d="M6.6 17.8v2M17.4 17.8v2M6.8 14.8h.01M17.2 14.8h.01"/>',
  briefcase: '<rect x="3" y="7.2" width="18" height="13" rx="2.4"/><path d="M8.8 7.2V4.8h6.4v2.4M3 12.6h18M10 12.6v2h4v-2"/>',
  heart: '<path d="M12 20.4S3.6 15.6 3.6 9.6a4.6 4.6 0 0 1 8.4-2.6 4.6 4.6 0 0 1 8.4 2.6c0 6-8.4 10.8-8.4 10.8Z"/>',
  tag: '<path d="M3.6 3.6h7.2l9.6 9.6-7.2 7.2-9.6-9.6z"/><circle cx="7.8" cy="7.8" r="1.4"/>',
  'arrow-right': '<path d="M4 12h15.6M13.4 5.8l6.2 6.2-6.2 6.2"/>',
  'arrow-left': '<path d="M20 12H4.4M10.6 5.8 4.4 12l6.2 6.2"/>',
  'arrow-up-right': '<path d="M6.6 17.4 17.4 6.6M8.4 6.6h9v9"/>',
  'arrow-down': '<path d="M12 4v15.6M5.8 13.4l6.2 6.2 6.2-6.2"/>',
  'wifi-off':
    '<path d="M3 3l18 18"/><path d="M8.5 15.5a5 5 0 0 1 7 0M5.2 12.2a10 10 0 0 1 3.6-2.3M18.8 12.2a10 10 0 0 0-3.2-2.1M2 8.8a15 15 0 0 1 5.4-2.7M22 8.8a15 15 0 0 0-9.4-2.7"/><circle cx="12" cy="19" r=".8" fill="currentColor" stroke="none"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.4"/><circle cx="12" cy="7.8" r=".9" fill="currentColor" stroke="none"/>',
  refresh:
    '<path d="M3.4 12a8.6 8.6 0 1 0 2.6-6.2"/><path d="M3.4 3.6v5.2h5.2"/>',
  coffee:
    '<path d="M4.4 8.4h11.2v5.8a5.6 5.6 0 0 1-11.2 0z"/><path d="M15.6 9.6h1.8a2.8 2.8 0 0 1 0 5.6h-1.8M8.4 3.4v2M12 3.4v2M4 21h14"/>',
  leaf: '<path d="M20.4 3.6C11.6 3.6 4.4 7.2 4.4 14a5.8 5.8 0 0 0 5.8 5.8c6.8 0 10.2-7.2 10.2-16.2Z"/><path d="M4 21c2.4-6 6.2-10.2 11.4-13.4"/>',
  mail: '<rect x="2.8" y="5" width="18.4" height="14" rx="2.4"/><path d="m3.6 6.4 8.4 6.4 8.4-6.4"/>',
  eye: '<path d="M2.2 12S5.8 5.4 12 5.4 21.8 12 21.8 12 18.2 18.6 12 18.6 2.2 12 2.2 12Z"/><circle cx="12" cy="12" r="2.8"/>',
  'thumbs-up':
    '<path d="M7.2 10.4v10.2H4.2a1.2 1.2 0 0 1-1.2-1.2v-7.8a1.2 1.2 0 0 1 1.2-1.2z"/><path d="M7.2 10.4 11 3.6a2 2 0 0 1 3.6 1.5l-.7 4.1h5.1a2 2 0 0 1 2 2.3l-1.2 7a2 2 0 0 1-2 1.7H7.2"/>',
  'chevrons-up': '<path d="m6.4 12.4 5.6-5.6 5.6 5.6M6.4 17.6 12 12l5.6 5.6"/>',
  palette:
    '<path d="M12 21.2a9.2 9.2 0 1 1 9.2-9.2c0 2.4-2 3.4-3.8 3.4h-1.7a2.2 2.2 0 0 0-1.6 3.7c.7.8.2 2.1-2.1 2.1Z"/><circle cx="7.8" cy="9.2" r="1.2" fill="currentColor" stroke="none"/><circle cx="12" cy="7" r="1.2" fill="currentColor" stroke="none"/><circle cx="16.2" cy="9.2" r="1.2" fill="currentColor" stroke="none"/>',
  wand: '<path d="M4 20 16.8 7.2M14.4 5.2l1.2-2.2 1.2 2.2 2.2 1.2-2.2 1.2-1.2 2.2-1.2-2.2-2.2-1.2zM5.4 4.2l.7 1.3 1.3.7-1.3.7-.7 1.3-.7-1.3-1.3-.7 1.3-.7z"/>',
  list: '<path d="M9 6h12M9 12h12M9 18h12"/><circle cx="4.4" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="4.4" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="4.4" cy="18" r="1" fill="currentColor" stroke="none"/>',
  inbox:
    '<path d="M3.2 13.2 5.8 4.4h12.4l2.6 8.8v5.4a1.8 1.8 0 0 1-1.8 1.8H5a1.8 1.8 0 0 1-1.8-1.8z"/><path d="M3.2 13.2h5l1.2 2.4h5.2l1.2-2.4h5"/>',
  lock: '<rect x="4.6" y="10.2" width="14.8" height="10.4" rx="2.6"/><path d="M8.2 10.2V7.8a3.8 3.8 0 0 1 7.6 0v2.4M12 14.2v2.6"/>',
};

export function icon(name, size = 20, cls = '') {
  const body = P[name];
  if (!body) return '';
  return `<svg class="icon ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
}

export const iconNames = Object.keys(P);
