/**
 * Pip — an original seed-pod companion.
 * Drawn from scratch: terracotta pod, cream belly, ink line, two-leaf sprout.
 * Expressions: happy · thinking · celebrating · sleepy · worried.
 */

/**
 * Pip's ink and colour come from CSS custom properties so the whole cast can
 * change colourway at once (Settings → Pip's look) without re-rendering each
 * illustration by hand.
 */
const INK = 'var(--pip-ink)';
const POD = 'var(--pip-pod)';
const POD_DEEP = 'var(--pip-pod-deep)';
const CREAM = 'var(--pip-cream)';
const LEAF = 'var(--pip-leaf)';
const LEAF_DARK = 'var(--pip-leaf-dark)';
const CHEEK = 'var(--pip-cheek)';

export const MASCOT_STYLES = [
  { id: 'classic', label: 'Terracotta', swatch: '#c9673f', note: 'The original pod' },
  { id: 'sage', label: 'Sage', swatch: '#7c9370', note: 'Quiet and leafy' },
  { id: 'clay', label: 'Clay rose', swatch: '#a8615a', note: 'A warmer blush' },
  { id: 'ochre', label: 'Ochre', swatch: '#b98a3f', note: 'Late afternoon' },
];

/** Sets the colourway on <html>; the SVG reads the matching CSS variables. */
export function applyMascotStyle(id = 'classic') {
  const known = MASCOT_STYLES.some((s) => s.id === id) ? id : 'classic';
  document.documentElement.dataset.mascot = known;
  return known;
}

function eyesHappy() {
  return `
    <ellipse cx="86" cy="101" rx="3.5" ry="4.3" fill="${INK}"/>
    <ellipse cx="114" cy="101" rx="3.5" ry="4.3" fill="${INK}"/>
    <circle cx="87.3" cy="99.3" r="1.15" fill="var(--pip-cream)"/>
    <circle cx="115.3" cy="99.3" r="1.15" fill="var(--pip-cream)"/>`;
}

const FACES = {
  happy: `
    ${eyesHappy()}
    <path d="M90.5 115.5c5 6 14 6 19 0" fill="none" stroke="${INK}" stroke-width="3.2" stroke-linecap="round"/>`,
  thinking: `
    <ellipse cx="88" cy="101" rx="3.5" ry="4.3" fill="${INK}"/>
    <ellipse cx="116" cy="101" rx="3.5" ry="4.3" fill="${INK}"/>
    <circle cx="89.6" cy="99.3" r="1.15" fill="var(--pip-cream)"/>
    <circle cx="117.6" cy="99.3" r="1.15" fill="var(--pip-cream)"/>
    <path d="M80.5 92.5c2.5-2 5.5-2.2 8-1" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>
    <ellipse cx="105.5" cy="118.5" rx="2.8" ry="3.6" fill="${INK}"/>`,
  celebrating: `
    <path d="M81 102.5c3-3.4 7-3.4 10 0" fill="none" stroke="${INK}" stroke-width="3.2" stroke-linecap="round"/>
    <path d="M109 102.5c3-3.4 7-3.4 10 0" fill="none" stroke="${INK}" stroke-width="3.2" stroke-linecap="round"/>
    <path d="M88.5 113.5c3.2 10.2 19.8 10.2 23 0z" fill="${INK}" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
    <path d="M95.5 120c2.5 3.6 6.5 3.6 9 0z" fill="${POD_DEEP}"/>`,
  sleepy: `
    <path d="M81 101.5c3 3.2 6.8 3.2 9.8 0" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
    <path d="M109.2 101.5c3 3.2 6.8 3.2 9.8 0" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
    <path d="M96 118h8" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`,
  worried: `
    ${eyesHappy()}
    <path d="M79.5 92.5 88 95M120.5 92.5 112 95" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M91.5 119c3.2-3.6 5.2-2.4 8.5 0s5.2 2.6 8.5-1" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`,
};

function arms(mood) {
  if (mood === 'celebrating') {
    return `
      <path d="M63 110c-8-3-13-9-16-17" fill="none" stroke="${INK}" stroke-width="9" stroke-linecap="round"/>
      <path d="M63 110c-8-3-13-9-16-17" fill="none" stroke="${POD}" stroke-width="4.6" stroke-linecap="round"/>
      <path d="M137 110c8-3 13-9 16-17" fill="none" stroke="${INK}" stroke-width="9" stroke-linecap="round"/>
      <path d="M137 110c8-3 13-9 16-17" fill="none" stroke="${POD}" stroke-width="4.6" stroke-linecap="round"/>
      <circle cx="45" cy="90" r="5.4" fill="${POD}" stroke="${INK}" stroke-width="2.8"/>
      <circle cx="155" cy="90" r="5.4" fill="${POD}" stroke="${INK}" stroke-width="2.8"/>`;
  }
  if (mood === 'thinking') {
    return `
      <path d="M137 120c9 0 14-7 11-14" fill="none" stroke="${INK}" stroke-width="9" stroke-linecap="round"/>
      <path d="M137 120c9 0 14-7 11-14" fill="none" stroke="${POD}" stroke-width="4.6" stroke-linecap="round"/>
      <path d="M63 121c-6 3-9 7-10 12" fill="none" stroke="${INK}" stroke-width="9" stroke-linecap="round"/>
      <path d="M63 121c-6 3-9 7-10 12" fill="none" stroke="${POD}" stroke-width="4.6" stroke-linecap="round"/>`;
  }
  return `
    <path d="M62 118c-7 3-11 8-12 14" fill="none" stroke="${INK}" stroke-width="9" stroke-linecap="round"/>
    <path d="M62 118c-7 3-11 8-12 14" fill="none" stroke="${POD}" stroke-width="4.6" stroke-linecap="round"/>
    <path d="M138 118c7 3 11 8 12 14" fill="none" stroke="${INK}" stroke-width="9" stroke-linecap="round"/>
    <path d="M138 118c7 3 11 8 12 14" fill="none" stroke="${POD}" stroke-width="4.6" stroke-linecap="round"/>`;
}

function extras(mood) {
  if (mood === 'sleepy') {
    return `
      <g fill="none" stroke="var(--pip-line)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
        <path d="M146 55h9l-9 10h9"/>
        <path d="M161 36h6.5l-6.5 7.5h6.5" opacity=".65"/>
      </g>`;
  }
  if (mood === 'celebrating') {
    return `
      <g stroke="none">
        <rect x="32" y="44" width="7" height="11" rx="1.5" fill="var(--pip-confetti-a)" transform="rotate(-24 35 49)"/>
        <rect x="157" y="35" width="6" height="10" rx="1.5" fill="var(--pip-confetti-b)" transform="rotate(20 160 40)"/>
        <circle cx="47" cy="70" r="3.4" fill="${POD_DEEP}"/>
        <circle cx="161" cy="64" r="2.6" fill="var(--pip-confetti-c)"/>
        <path d="M120 26l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="var(--pip-confetti-a)" opacity=".8"/>
      </g>`;
  }
  if (mood === 'worried') {
    return `
      <path d="M141 80c1.6 3.2 4.8 4.6 7.4 3 2.4-1.6 2.6-5 .8-7.8-1.6-2.6-4.6-4.8-8.2-6.2.2 4 .2 8 0 11Z" fill="var(--pip-ice)" stroke="${INK}" stroke-width="2" stroke-linejoin="round" opacity=".9"/>`;
  }
  if (mood === 'thinking') {
    return `
      <g fill="var(--pip-line)" stroke="none">
        <circle cx="150" cy="62" r="2.6" opacity=".8"/>
        <circle cx="160" cy="52" r="1.8" opacity=".55"/>
      </g>`;
  }
  return '';
}

export function pip({
  mood = 'happy',
  size = 120,
  className = '',
  title = '',
  float = false,
} = {}) {
  const label = title
    ? `role="img" aria-label="${title}"`
    : 'aria-hidden="true"';
  const armsMarkup = arms(mood);
  return `<svg class="pip pip--${mood} ${float ? 'pip--float' : ''} ${className}" width="${size}" height="${size}" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" ${label}>
    <ellipse cx="100" cy="181" rx="36" ry="6" fill="${INK}" opacity=".13"/>
    ${extras(mood)}
    <path d="M100 30c1.6-8 1-15-2.4-22" stroke="${LEAF_DARK}" stroke-width="4" stroke-linecap="round"/>
    <path d="M99.5 14.5C89 16 81.5 11 80 3.6c10-1.6 17.5 3.4 19.5 10.9Z" fill="${LEAF}" stroke="${LEAF_DARK}" stroke-width="2.6" stroke-linejoin="round"/>
    <path d="M101.5 11.5c1.4-7.8 8.4-12.2 16.5-10.6.2 8-6.4 12.8-16.5 10.6Z" fill="var(--pip-leaf-light)" stroke="${LEAF_DARK}" stroke-width="2.6" stroke-linejoin="round"/>
    <path d="M86 154c-.4 6-.6 11-.6 15M114 154c.4 6 .6 11 .6 15" stroke="${INK}" stroke-width="9" stroke-linecap="round"/>
    <path d="M86 154c-.4 6-.6 11-.6 15M114 154c.4 6 .6 11 .6 15" stroke="${POD}" stroke-width="4.2" stroke-linecap="round"/>
    <path d="M78.2 170c0 3 3.4 4.8 8 4.8s7.6-1.9 7.6-4.8-3.4-3.5-7.8-3.5-7.8.5-7.8 3.5Z" fill="${POD}" stroke="${INK}" stroke-width="2.8"/>
    <path d="M106.2 170c0 3 3.4 4.8 8 4.8s7.6-1.9 7.6-4.8-3.4-3.5-7.8-3.5-7.8.5-7.8 3.5Z" fill="${POD}" stroke="${INK}" stroke-width="2.8"/>
    <path d="M100 24c17 0 28 12 33 30 6 22 6 45-2 62-5 11-14 21-24 28-4 3-10 3-14 0-10-7-19-17-24-28-8-17-8-40-2-62 5-18 16-30 33-30Z" fill="${POD}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
    <path d="M100 47c11 0 19 8 21.5 21 2.7 15 1 31-5 42-4 8-10 14-16.5 19-6.5-5-12.5-11-16.5-19-6-11-7.7-27-5-42C81 55 89 47 100 47Z" fill="${CREAM}"/>
    <path d="M77.5 130c8 12 15 18 22.5 23 7.5-5 14.5-11 22.5-23" fill="none" stroke="${POD_DEEP}" stroke-width="1.8" stroke-dasharray="2 6" stroke-linecap="round" opacity=".55"/>
    <path d="M68 78c-2 12-1 26 4 38" fill="none" stroke="var(--pip-highlight)" stroke-width="5" stroke-linecap="round" opacity=".38"/>
    <circle cx="76.5" cy="113" r="6.4" fill="${CHEEK}" opacity=".5"/>
    <circle cx="123.5" cy="113" r="6.4" fill="${CHEEK}" opacity=".5"/>
    <g fill="${POD_DEEP}" opacity=".5">
      <circle cx="75" cy="106" r="1.1"/><circle cx="71.5" cy="110" r="1.1"/><circle cx="78" cy="111" r="1"/>
      <circle cx="125" cy="106" r="1.1"/><circle cx="128.5" cy="110" r="1.1"/><circle cx="122" cy="111" r="1"/>
    </g>
    ${armsMarkup}
    ${FACES[mood] || FACES.happy}
  </svg>`;
}

/** Compact pod glyph used in the wordmark / tiny contexts. */
export function pipGlyph(size = 22, cls = '') {
  return `<svg class="pip-glyph ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
    <path d="M12 20.6c-3.9-2.8-5.7-6-5.7-9.3C6.3 7.3 8.7 4.9 12 4.9s5.7 2.4 5.7 6.4c0 3.3-1.8 6.5-5.7 9.3Z"/>
    <path d="M12 4.9V2.2"/>
    <path d="M11.8 3.3C10 3.2 8.8 2.1 8.8.7c1.8.1 3 1.2 3 2.6Z" fill="currentColor" stroke="none"/>
    <path d="M12.2 3.1c1.8-.1 3-1.2 3-2.6-1.8.1-3 1.2-3 2.6Z" fill="currentColor" stroke="none"/>
  </svg>`;
}

/** Pip in a wax-seal stamp. */
export function pipStamp(size = 48, mood = 'happy') {
  return `<span class="pip-stamp" style="--stamp:${size}px">${pip({ mood, size: Math.round(size * 0.92) })}</span>`;
}
