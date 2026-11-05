/**
 * Puffy — an original desk companion.
 * Four hand-drawn forms share one face, palette and mood system:
 * a paper lantern (default), a moth, a river pebble and a coffee cup.
 * Expressions: happy · thinking · celebrating · sleepy · worried.
 */

/**
 * Puffy's ink and colour come from CSS custom properties so the whole cast can
 * change colourway at once (Settings → Puffy's look) without re-rendering each
 * illustration by hand.
 */
const INK = 'var(--puffy-ink)';
const POD = 'var(--puffy-pod)';
const POD_DEEP = 'var(--puffy-pod-deep)';
const CREAM = 'var(--puffy-cream)';
const LEAF = 'var(--puffy-leaf)';
const LEAF_DARK = 'var(--puffy-leaf-dark)';
const CHEEK = 'var(--puffy-cheek)';

export const MASCOT_STYLES = [
  { id: 'slate', label: 'Slate', swatch: '#5f7482', note: 'A cool blue for warm rooms' },
  { id: 'sage', label: 'Sage', swatch: '#7c9370', note: 'Quiet and leafy' },
  { id: 'clay', label: 'Clay rose', swatch: '#a8615a', note: 'A warmer blush' },
  { id: 'ochre', label: 'Ochre', swatch: '#96681c', note: 'Deep amber against the paper' },
];

export const MASCOT_FORMS = [
  { id: 'lantern', label: 'Lantern', note: 'A small warm glow for the desk' },
  { id: 'moth', label: 'Moth', note: 'Quiet, always drawn to the light' },
  { id: 'pebble', label: 'Pebble', note: 'Steady as a stone from the river' },
  { id: 'coffee', label: 'Coffee', note: 'A warm cup for slow mornings' },
];

const FORM_IDS = new Set(MASCOT_FORMS.map((f) => f.id));

/** Sets the colourway on <html>; the SVG reads the matching CSS variables. */
export function applyMascotStyle(id = 'slate') {
  // Older installs stored 'classic'; Slate now fills that slot.
  const known = MASCOT_STYLES.some((s) => s.id === id) ? id : 'slate';
  document.documentElement.dataset.mascot = known;
  return known;
}

/** Sets Puffy's silhouette on <html>; new renders follow it immediately. */
export function applyMascotForm(id = 'lantern') {
  const known = FORM_IDS.has(id) ? id : 'lantern';
  document.documentElement.dataset.puffyForm = known;
  document.documentElement.dataset.pipForm = known;
  return known;
}

export function getMascotForm() {
  const current = document.documentElement.dataset.puffyForm || document.documentElement.dataset.pipForm;
  return FORM_IDS.has(current) ? current : 'lantern';
}

function eyesHappy() {
  return `
    <ellipse cx="86" cy="101" rx="3.5" ry="4.3" fill="${INK}"/>
    <ellipse cx="114" cy="101" rx="3.5" ry="4.3" fill="${INK}"/>
    <circle cx="87.3" cy="99.3" r="1.15" fill="var(--puffy-cream)"/>
    <circle cx="115.3" cy="99.3" r="1.15" fill="var(--puffy-cream)"/>`;
}

const FACES = {
  happy: `
    ${eyesHappy()}
    <path d="M90.5 115.5c5 6 14 6 19 0" fill="none" stroke="${INK}" stroke-width="3.2" stroke-linecap="round"/>`,
  thinking: `
    <ellipse cx="88" cy="101" rx="3.5" ry="4.3" fill="${INK}"/>
    <ellipse cx="116" cy="101" rx="3.5" ry="4.3" fill="${INK}"/>
    <circle cx="89.6" cy="99.3" r="1.15" fill="var(--puffy-cream)"/>
    <circle cx="117.6" cy="99.3" r="1.15" fill="var(--puffy-cream)"/>
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

function cheeks(left = 79, right = 121, cy = 113, r = 5.6) {
  return `
    <circle cx="${left}" cy="${cy}" r="${r}" fill="${CHEEK}" opacity=".5"/>
    <circle cx="${right}" cy="${cy}" r="${r}" fill="${CHEEK}" opacity=".5"/>`;
}

function shadow(rx = 38) {
  return `<ellipse cx="100" cy="183" rx="${rx}" ry="6" fill="${INK}" opacity=".13"/>`;
}

/* ---- The four forms ------------------------------------------------------ */

/** Paper lantern: loop, cap, barrel body, cream window, tassel. */
function lanternForm(mood) {
  return `
    ${shadow(37)}
    <circle cx="100" cy="19" r="4.2" fill="none" stroke="${INK}" stroke-width="3"/>
    <path d="M100 23.2v7" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
    <path d="M100 42c21 0 33 6 39 19 7 14 7 41 0 57-6 13-18 23-39 23s-33-10-39-23c-7-16-7-43 0-57 6-13 18-19 39-19Z" fill="${POD}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
    <path d="M70 46c1.5-8 6-13.5 13-16.5h34c7 3 11.5 8.5 13 16.5Z" fill="${POD_DEEP}" stroke="${INK}" stroke-width="3.6" stroke-linejoin="round"/>
    <path d="M100 54c14.5 0 24 6.5 27 17.5 3 12 3 28 0 40-3 11-12.5 17.5-27 17.5s-24-6.5-27-17.5c-3-12-3-28 0-40 3-11 12.5-17.5 27-17.5Z" fill="${CREAM}"/>
    <g fill="none" stroke="${POD_DEEP}" stroke-width="2" stroke-linecap="round" opacity=".5">
      <path d="M74 65c-4 25-4 47 2 65"/>
      <path d="M126 65c4 25 4 47-2 65"/>
    </g>
    <g fill="none" stroke="${POD_DEEP}" stroke-width="1.3" stroke-linecap="round" opacity=".2">
      <path d="M89 57c-2 29-2 51 0 73"/>
      <path d="M111 57c2 29 2 51 0 73"/>
    </g>
    <path d="M100 142v8" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M96 150h8l-2.2 12h-3.6Z" fill="${POD_DEEP}" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>
    ${arms(mood)}
    ${cheeks(78, 122, 112, 5.6)}`;
}

/** Moth: two pairs of paper wings, a soft body, feathery antennae. */
function mothForm(mood) {
  return `
    ${shadow(34)}
    <path d="M91 70C78 43 50 32 30 41 11 50 7 73 19 90c10 14 28 22 50 23 9 0 16-1 23-3Z" fill="${POD}" stroke="${INK}" stroke-width="3.4" stroke-linejoin="round"/>
    <path d="M109 70c13-27 41-38 61-29 19 9 23 32 11 49-10 14-28 22-50 23-9 0-16-1-23-3Z" fill="${POD}" stroke="${INK}" stroke-width="3.4" stroke-linejoin="round"/>
    <ellipse cx="45" cy="72" rx="11" ry="14" fill="${CREAM}" stroke="${POD_DEEP}" stroke-width="1.5" transform="rotate(-18 45 72)"/>
    <ellipse cx="155" cy="72" rx="11" ry="14" fill="${CREAM}" stroke="${POD_DEEP}" stroke-width="1.5" transform="rotate(18 155 72)"/>
    <circle cx="43" cy="76" r="3.2" fill="${POD_DEEP}" opacity=".55"/>
    <circle cx="157" cy="76" r="3.2" fill="${POD_DEEP}" opacity=".55"/>
    <path d="M92 108c-17 3-30 14-32 27-1 11 11 18 24 12 9-4 14-16 17-28Z" fill="${POD}" stroke="${INK}" stroke-width="3.2" stroke-linejoin="round"/>
    <path d="M108 108c17 3 30 14 32 27 1 11-11 18-24 12-9-4-14-16-17-28Z" fill="${POD}" stroke="${INK}" stroke-width="3.2" stroke-linejoin="round"/>
    <circle cx="76" cy="139" r="4.6" fill="${CREAM}" opacity=".8"/>
    <circle cx="124" cy="139" r="4.6" fill="${CREAM}" opacity=".8"/>
    <path d="M100 40c17 0 28 10 28 24v64c0 14-11 24-28 24s-28-10-28-24V64c0-14 11-24 28-24Z" fill="${POD}" stroke="${INK}" stroke-width="3.8" stroke-linejoin="round"/>
    <path d="M100 50c12 0 20 8 20 19v54c0 11-8 19-20 19s-20-8-20-19V69c0-11 8-19 20-19Z" fill="${CREAM}"/>
    <g fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round">
      <path d="M91 44C84 36 82 27 76 20"/>
      <path d="M76 20 70 16M76 20l-2-7M76 20l5-5"/>
      <path d="M109 44c7-8 9-17 15-24"/>
      <path d="M124 20l6-4M124 20l2-7M124 20l-5-5"/>
    </g>
    <g fill="none" stroke="${INK}" stroke-width="3.4" stroke-linecap="round">
      <path d="M94 150v10M106 150v10"/>
    </g>
    ${cheeks(82, 118, 111, 4.4)}`;
}

/** River pebble: an asymmetric stone, moss cap, lichen-coloured face patch. */
function pebbleForm(mood) {
  return `
    ${shadow(40)}
    <path d="M98 48c20-1 38 8 48 23 11 16 12 37 3 53-9 16-26 28-45 30-19 2-36-6-46-19-11-14-12-34-5-50 7-17 25-36 45-37Z" fill="${POD}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
    <path d="M61 75c3-14 14-25 30-28 21-4 43 0 53 16-7 7-19 10-33 10-19 0-36-1-50 2Z" fill="${LEAF}" stroke="${LEAF_DARK}" stroke-width="2.6" stroke-linejoin="round"/>
    <g fill="${LEAF_DARK}" opacity=".45">
      <circle cx="82" cy="64" r="1.2"/><circle cx="96" cy="58" r="1"/><circle cx="118" cy="62" r="1.3"/><circle cx="132" cy="68" r="1"/>
    </g>
    <path d="M99 80c16-1 28 9 30 23 2 14-5 26-16 31-9 4-19 3-27-3-9-7-14-19-12-31 2-13 11-20 25-20Z" fill="${CREAM}"/>
    <g fill="none" stroke="${INK}" stroke-width="1.8" stroke-linecap="round" opacity=".2">
      <path d="M58 104c4 2 7 6 8 11M142 92c-4 1-7 4-9 8"/>
    </g>
    <g fill="none" stroke="${INK}" stroke-width="7.5" stroke-linecap="round">
      <path d="M84 150c-.4 6-.6 10-.4 12M116 150c.4 6 .6 10 .4 12"/>
    </g>
    <g fill="none" stroke="${POD}" stroke-width="3.6" stroke-linecap="round">
      <path d="M84 150c-.4 6-.6 10-.4 12M116 150c.4 6 .6 10 .4 12"/>
    </g>
    <ellipse cx="84" cy="164" rx="7.4" ry="3.6" fill="${POD}" stroke="${INK}" stroke-width="2.6"/>
    <ellipse cx="116" cy="164" rx="7.4" ry="3.6" fill="${POD}" stroke="${INK}" stroke-width="2.6"/>
    ${arms(mood)}
    ${cheeks(82, 118, 111, 5.2)}`;
}

/** Coffee: a takeaway cup with a deep lid, cream sleeve and three curls of steam. */
function coffeeForm(mood) {
  return `
    ${shadow(36)}
    <g fill="none" stroke="${POD_DEEP}" stroke-width="3.2" stroke-linecap="round" opacity=".42">
      <path d="M83 46c-6.5-8 6.5-13 0-22"/>
      <path d="M100 42c-6.5-8 6.5-13 0-22"/>
      <path d="M117 46c-6.5-8 6.5-13 0-22"/>
    </g>
    <path d="M66 62h68l-7 98c-.5 6.4-5.8 11-12.2 11H85.2c-6.4 0-11.7-4.6-12.2-11Z" fill="${POD}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
    <path d="M69 128h62l-5 30c-.4 3-2.8 5-5.8 5H79.8c-3 0-5.4-2-5.8-5Z" fill="${CREAM}" stroke="${POD_DEEP}" stroke-width="2.2" stroke-linejoin="round"/>
    <g fill="none" stroke="${POD_DEEP}" stroke-width="1.3" stroke-linecap="round" opacity=".42">
      <path d="M72.4 136h55.2M73.6 144h52.8M74.8 152h50.4"/>
    </g>
    <path d="M60 54h80c3.3 0 6 2.7 6 6v7c0 2.2-1.8 4-4 4H58c-2.2 0-4-1.8-4-4v-7c0-3.3 2.7-6 6-6Z" fill="${POD_DEEP}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
    <ellipse cx="100" cy="54" rx="40" ry="7.6" fill="${POD}" stroke="${INK}" stroke-width="3.4"/>
    <rect x="116" y="49.5" width="11" height="5" rx="2.5" fill="${CREAM}" opacity=".85"/>
    ${arms(mood)}
    ${cheeks(80, 120, 112, 5.2)}`;
}

const FORMS = {
  lantern: lanternForm,
  moth: mothForm,
  pebble: pebbleForm,
  coffee: coffeeForm,
};

function extras(mood) {
  if (mood === 'sleepy') {
    return `
      <g fill="none" stroke="var(--puffy-line)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
        <path d="M146 55h9l-9 10h9"/>
        <path d="M161 36h6.5l-6.5 7.5h6.5" opacity=".65"/>
      </g>`;
  }
  if (mood === 'celebrating') {
    return `
      <g stroke="none">
        <rect x="32" y="44" width="7" height="11" rx="1.5" fill="var(--puffy-confetti-a)" transform="rotate(-24 35 49)"/>
        <rect x="157" y="35" width="6" height="10" rx="1.5" fill="var(--puffy-confetti-b)" transform="rotate(20 160 40)"/>
        <circle cx="47" cy="70" r="3.4" fill="${POD_DEEP}"/>
        <circle cx="161" cy="64" r="2.6" fill="var(--puffy-confetti-c)"/>
        <path d="M120 26l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="var(--puffy-confetti-a)" opacity=".8"/>
      </g>`;
  }
  if (mood === 'worried') {
    return `
      <path d="M141 80c1.6 3.2 4.8 4.6 7.4 3 2.4-1.6 2.6-5 .8-7.8-1.6-2.6-4.6-4.8-8.2-6.2.2 4 .2 8 0 11Z" fill="var(--puffy-ice)" stroke="${INK}" stroke-width="2" stroke-linejoin="round" opacity=".9"/>`;
  }
  if (mood === 'thinking') {
    return `
      <g fill="var(--puffy-line)" stroke="none">
        <circle cx="150" cy="62" r="2.6" opacity=".8"/>
        <circle cx="160" cy="52" r="1.8" opacity=".55"/>
      </g>`;
  }
  return '';
}

export function puffy({
  mood = 'happy',
  size = 120,
  className = '',
  title = '',
  float = false,
  form = getMascotForm(),
} = {}) {
  const shape = FORM_IDS.has(form) ? form : 'lantern';
  const label = title
    ? `role="img" aria-label="${title}"`
    : 'aria-hidden="true"';
  return `<svg class="puffy pip puffy--${mood} pip--${mood} puffy--${shape} pip--${shape} ${float ? 'puffy--float pip--float' : ''} ${className}" data-form="${shape}" width="${size}" height="${size}" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" ${label}>
    ${extras(mood)}
    ${FORMS[shape](mood)}
    ${FACES[mood] || FACES.happy}
  </svg>`;
}

/** Compact glyph used in the wordmark / tiny contexts; follows Puffy's form. */
export function puffyGlyph(size = 22, cls = '', form = getMascotForm()) {
  const shape = FORM_IDS.has(form) ? form : 'lantern';
  const art = {
    lantern: `
      <circle cx="12" cy="3" r="1.1"/>
      <path d="M12 4.1v2"/>
      <path d="M9.4 6.1h5.2"/>
      <path d="M8.4 7.2c-1.2 2-1.2 7.4 0 9.4.9 1.5 2 2.2 3.6 2.2s2.7-.7 3.6-2.2c1.2-2 1.2-7.4 0-9.4"/>
      <path d="M8.4 7.2h7.2"/>
      <path d="M12 18.8v2.4M10.2 21.2h3.6"/>`,
    moth: `
      <path d="M9.2 10.2C7.6 7.4 4.6 6 2.8 7.1 1.2 8.1 1.4 11 3 12.9c1.2 1.4 3.2 2.1 5.4 2.1"/>
      <path d="M14.8 10.2c1.6-2.8 4.6-4.2 6.4-3.1 1.6 1 1.4 3.9-.2 5.8-1.2 1.4-3.2 2.1-5.4 2.1"/>
      <path d="M12 8.2c1 0 1.7 1 1.7 2.2v7.2c0 1.2-.7 2.2-1.7 2.2s-1.7-1-1.7-2.2v-7.2c0-1.2.7-2.2 1.7-2.2Z"/>
      <path d="M10.8 8 9.6 5.2M13.2 8l1.2-2.8"/>`,
    pebble: `
      <path d="M11.8 5.2c3.2-.2 6 1.2 7.4 3.6 1.4 2.4 1.4 5.6-.2 7.8-1.6 2.2-4.2 3.4-6.8 3.2-2.6-.2-5-1.8-6-4.2-1-2.4-.8-5.2.8-7.2 1.2-1.6 2.8-2.8 4.8-3.2Z"/>
      <path d="M6.4 9.2c1.2-1.6 3.4-2.4 5.6-2.4 2.8 0 5.4.8 6.6 2.6"/>`,
    coffee: `
      <path d="M6.6 8.6h10.8l-.9 9.4c-.1 1.2-1.1 2.1-2.3 2.1h-4.4c-1.2 0-2.2-.9-2.3-2.1Z"/>
      <path d="M6.2 6.1h11.6v2.5H6.2z"/>
      <path d="M10 4.6c-.8-.9.6-1.4 0-2.4M14 4.6c-.8-.9.6-1.4 0-2.4"/>
      <path d="M8.4 12.4h7.2"/>`,
  }[shape];
  return `<svg class="puffy-glyph pip-glyph ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" data-form="${shape}">
    ${art}
  </svg>`;
}

/** Puffy in a wax-seal stamp. */
export function puffyStamp(size = 48, mood = 'happy') {
  return `<span class="puffy-stamp pip-stamp" data-puffy-stamp="${mood}" data-pip-stamp="${mood}" style="--stamp:${size}px">${puffy({ mood, size: Math.round(size * 0.92) })}</span>`;
}

export const pipStamp = puffyStamp;
export const pipGlyph = puffyGlyph;
export const pip = puffy;
