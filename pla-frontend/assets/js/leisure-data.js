/**
 * Static content and quiet generators for the leisure corner. These are not
 * records: nothing here is read or written through api.js. Boards are curated
 * or generated so every set is unambiguous, kind, and playable without a
 * dictionary.
 */

export const FREE_LEVELS = 6;
export const MAX_LEVEL = 36;
export const PLUS_LEVELS = MAX_LEVEL - FREE_LEVELS;

const shuffle = (list) => {
  const next = [...list];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
};

const pick = (list) => list[Math.floor(Math.random() * list.length)];

/* ------------------------------- Memory ---------------------------------- */

export const PAIR_SYMBOLS = [
  { icon: 'leaf', label: 'Leaf' },
  { icon: 'sun', label: 'Sun' },
  { icon: 'droplet', label: 'Drop' },
  { icon: 'moon', label: 'Moon' },
  { icon: 'star', label: 'Star' },
  { icon: 'cloud', label: 'Cloud' },
  { icon: 'flame', label: 'Flame' },
  { icon: 'sprout', label: 'Sprout' },
  { icon: 'heart', label: 'Heart' },
  { icon: 'coffee', label: 'Cup' },
  { icon: 'mail', label: 'Letter' },
  { icon: 'clock', label: 'Clock' },
  { icon: 'book', label: 'Book' },
  { icon: 'target', label: 'Target' },
  { icon: 'bolt', label: 'Bolt' },
  { icon: 'palette', label: 'Palette' },
];

/** Small decks first; the premium boards grow to twelve pairs. */
export function pairPlan(level) {
  const pairs = level <= 1 ? 4 : level <= 3 ? 6 : level <= 5 ? 8 : level <= 6 ? 9 : level <= 9 ? 10 : level <= 14 ? 11 : 12;
  return { pairs: Math.min(pairs, PAIR_SYMBOLS.length) };
}

/* ----------------------------- Word grouping ----------------------------- */

export const WORD_BOARDS = [
  {
    id: 'citrus',
    groups: [
      { name: 'Citrus', words: ['lemon', 'lime', 'orange'] },
      { name: 'Quiet sounds', words: ['hush', 'murmur', 'whisper'] },
      { name: 'Have handles', words: ['door', 'mug', 'umbrella'] },
    ],
  },
  {
    id: 'floating',
    groups: [
      { name: 'Herbs', words: ['basil', 'mint', 'thyme'] },
      { name: 'Things that float', words: ['boat', 'cloud', 'leaf'] },
      { name: 'Soft colours', words: ['blush', 'cream', 'sage'] },
    ],
  },
  {
    id: 'toolbox',
    groups: [
      { name: 'In a toolbox', words: ['hammer', 'nail', 'screwdriver'] },
      { name: 'Walk slowly', words: ['amble', 'stroll', 'wander'] },
      { name: 'Freshwater fish', words: ['carp', 'perch', 'trout'] },
    ],
  },
  {
    id: 'rainy',
    groups: [
      { name: 'Rainy-day things', words: ['boots', 'raincoat', 'umbrella'] },
      { name: 'Garden things', words: ['seed', 'soil', 'trowel'] },
      { name: 'Round things', words: ['coin', 'moon', 'wheel'] },
    ],
  },
  {
    id: 'spinning',
    groups: [
      { name: 'Board games', words: ['chess', 'checkers', 'dominoes'] },
      { name: 'Things that spin', words: ['fan', 'top', 'wheel'] },
      { name: 'Cloud types', words: ['cirrus', 'cumulus', 'stratus'] },
    ],
  },
  {
    id: 'instruments',
    groups: [
      { name: 'Instruments', words: ['drum', 'flute', 'piano'] },
      { name: 'Pencil-case things', words: ['eraser', 'ruler', 'sharpener'] },
      { name: 'Words for small', words: ['little', 'tiny', 'wee'] },
    ],
  },
  {
    id: 'wings',
    groups: [
      { name: 'Things with wings', words: ['bird', 'butterfly', 'plane'] },
      { name: 'Hot drinks', words: ['cocoa', 'coffee', 'tea'] },
      { name: 'Flowers', words: ['daisy', 'rose', 'tulip'] },
    ],
  },
  {
    id: 'night',
    groups: [
      { name: 'Night sky', words: ['comet', 'moon', 'star'] },
      { name: 'Sea creatures', words: ['crab', 'seal', 'whale'] },
      { name: 'Sticky things', words: ['glue', 'honey', 'tape'] },
    ],
  },
  {
    id: 'morning',
    groups: [
      { name: 'Breakfast foods', words: ['oats', 'toast', 'yogurt'] },
      { name: 'Things with pages', words: ['book', 'diary', 'passport'] },
      { name: 'Things that creak', words: ['door', 'floor', 'stairs'] },
    ],
  },
  {
    id: 'kitchen',
    groups: [
      { name: 'In a kitchen', words: ['kettle', 'spoon', 'towel'] },
      { name: 'Soft fabrics', words: ['cotton', 'linen', 'wool'] },
      { name: 'Plants', words: ['fern', 'moss', 'vine'] },
    ],
  },
];

/** Levels 1–6 walk through the clearest boards, in this order. */
export const WORD_FREE_ORDER = ['citrus', 'wings', 'floating', 'rainy', 'instruments', 'kitchen'];

export const WORD_GROUP_POOL = WORD_BOARDS.flatMap((board) =>
  board.groups.map((group) => ({ ...group, board: board.id }))
);

export function wordPlan(level) {
  return { groups: level <= FREE_LEVELS ? 3 : level <= 18 ? 4 : 5 };
}

/** A full nine-to-fifteen word board for a level. */
export function buildWordBoard(level) {
  if (level <= FREE_LEVELS) {
    const id = WORD_FREE_ORDER[(level - 1) % WORD_FREE_ORDER.length];
    const source = WORD_BOARDS.find((board) => board.id === id) || WORD_BOARDS[0];
    return {
      id: `${source.id}-${level}`,
      mixed: false,
      groups: source.groups.map((group) => ({ ...group, words: [...group.words] })),
    };
  }

  const wanted = wordPlan(level).groups;
  const usedWords = new Set();
  const usedNames = new Set();
  const groups = [];
  for (const group of shuffle(WORD_GROUP_POOL)) {
    if (usedNames.has(group.name)) continue;
    if (group.words.some((word) => usedWords.has(word))) continue;
    groups.push({ name: group.name, words: [...group.words], board: group.board });
    usedNames.add(group.name);
    group.words.forEach((word) => usedWords.add(word));
    if (groups.length === wanted) break;
  }
  return {
    id: `mixed-${level}-${groups.map((group) => group.board).join('-')}`,
    mixed: true,
    groups,
  };
}

/* ------------------------------ Letter trail ----------------------------- */

export const TRAIL_WORDS = {
  short: [
    'moss', 'fern', 'mint', 'plum', 'rain', 'leaf', 'kite', 'nest',
    'warm', 'calm', 'oats', 'moon', 'star', 'sage', 'lamp', 'hush',
    'cozy', 'reed', 'gale', 'mist', 'dune', 'opal', 'wren', 'glow',
  ],
  medium: [
    'linen', 'amber', 'quiet', 'willow', 'meadow', 'pencil', 'harbor',
    'pebble', 'cotton', 'velvet', 'autumn', 'window', 'candle', 'ripple',
    'gentle', 'mellow', 'pillow', 'garden', 'marble', 'saucer', 'teacup',
    'basket', 'ribbon', 'hollow', 'shelter',
  ],
  long: [
    'orchard', 'drizzle', 'blanket', 'compass', 'journal', 'ladder',
    'tunnel', 'shimmer', 'blossom', 'clover', 'juniper', 'thistle',
    'sparrow', 'lantern', 'harbour', 'willow', 'sundial', 'meadow',
  ],
};

export function trailPlan(level) {
  return {
    size: level <= 2 ? 6 : level <= 4 ? 7 : level <= 12 ? 8 : 9,
    count: level <= 1 ? 3 : level <= 3 ? 4 : level <= 6 ? 5 : level <= 12 ? 6 : level <= 20 ? 7 : 8,
    diagonals: level > 6,
    reverse: level > 2,
  };
}

/** A calm word pool sized for the level. */
export function trailWords(level, count, size) {
  const pool =
    level <= 2
      ? TRAIL_WORDS.short
      : level <= 6
        ? [...TRAIL_WORDS.short, ...TRAIL_WORDS.medium]
        : [...TRAIL_WORDS.medium, ...TRAIL_WORDS.long];
  const usable = pool.filter((word) => word.length >= 4 && word.length <= size);
  const unique = [...new Set(usable)];
  return shuffle(unique).slice(0, Math.min(count, unique.length));
}

/* ----------------------------- Odd one out ------------------------------- */

export const ODD_ROUNDS = [
  { tier: 1, prompt: 'Three of these are citrus. Which one is not?', items: ['lemon', 'lime', 'orange', 'plum'], odd: 'plum' },
  { tier: 1, prompt: 'Three of these are quiet sounds. Which one is not?', items: ['hush', 'murmur', 'whisper', 'thunder'], odd: 'thunder' },
  { tier: 1, prompt: 'Three of these have handles. Which one does not?', items: ['door', 'mug', 'umbrella', 'cloud'], odd: 'cloud' },
  { tier: 1, prompt: 'Three of these are herbs. Which one is not?', items: ['basil', 'mint', 'thyme', 'maple'], odd: 'maple' },
  { tier: 1, prompt: 'Three of these float. Which one does not?', items: ['boat', 'cloud', 'leaf', 'stone'], odd: 'stone' },
  { tier: 1, prompt: 'Three of these are hot drinks. Which one is not?', items: ['cocoa', 'coffee', 'tea', 'lemonade'], odd: 'lemonade' },
  { tier: 1, prompt: 'Three of these are round. Which one is not?', items: ['coin', 'moon', 'wheel', 'book'], odd: 'book' },
  { tier: 1, prompt: 'Three of these are things with wings. Which one is not?', items: ['bird', 'butterfly', 'plane', 'frog'], odd: 'frog' },
  { tier: 1, prompt: 'Three of these are flowers. Which one is not?', items: ['daisy', 'rose', 'tulip', 'fern'], odd: 'fern' },
  { tier: 2, prompt: 'Three of these are freshwater fish. Which one is not?', items: ['carp', 'perch', 'trout', 'whale'], odd: 'whale' },
  { tier: 2, prompt: 'Three of these are board games. Which one is not?', items: ['chess', 'checkers', 'dominoes', 'kite'], odd: 'kite' },
  { tier: 2, prompt: 'Three of these are things with pages. Which one is not?', items: ['book', 'diary', 'passport', 'kettle'], odd: 'kettle' },
  { tier: 2, prompt: 'Three of these are soft fabrics. Which one is not?', items: ['cotton', 'linen', 'wool', 'glass'], odd: 'glass' },
  { tier: 2, prompt: 'Three of these grow in a garden. Which one does not?', items: ['fern', 'moss', 'vine', 'pebble'], odd: 'pebble' },
  { tier: 2, prompt: 'Three of these are breakfast foods. Which one is not?', items: ['oats', 'toast', 'yogurt', 'carrot'], odd: 'carrot' },
  { tier: 2, prompt: 'Three of these belong in a pencil case. Which one does not?', items: ['eraser', 'ruler', 'sharpener', 'spoon'], odd: 'spoon' },
  { tier: 2, prompt: 'Three of these are instruments. Which one is not?', items: ['drum', 'flute', 'piano', 'paintbrush'], odd: 'paintbrush' },
  { tier: 2, prompt: 'Three of these spin. Which one does not?', items: ['fan', 'top', 'wheel', 'chair'], odd: 'chair' },
  { tier: 2, prompt: 'Three of these are sea creatures. Which one is not?', items: ['crab', 'seal', 'whale', 'sparrow'], odd: 'sparrow' },
  { tier: 2, prompt: 'Three of these are sticky. Which one is not?', items: ['glue', 'honey', 'tape', 'sand'], odd: 'sand' },
  { tier: 3, prompt: 'Three of these mean small. Which one does not?', items: ['little', 'tiny', 'wee', 'vast'], odd: 'vast' },
  { tier: 3, prompt: 'Three of these are wet weather. Which one is not?', items: ['drizzle', 'mist', 'shower', 'sunshine'], odd: 'sunshine' },
  { tier: 3, prompt: 'Three of these belong in a toolbox. Which one does not?', items: ['hammer', 'nail', 'screwdriver', 'pillow'], odd: 'pillow' },
  { tier: 3, prompt: 'Three of these can creak. Which one does not?', items: ['door', 'floor', 'stairs', 'cushion'], odd: 'cushion' },
  { tier: 3, prompt: 'Three of these are winter things. Which one is not?', items: ['frost', 'mittens', 'scarf', 'sandals'], odd: 'sandals' },
  { tier: 3, prompt: 'Three of these are writing tools. Which one is not?', items: ['pencil', 'pen', 'chalk', 'cup'], odd: 'cup' },
  { tier: 3, prompt: 'Three of these are night-sky things. Which one is not?', items: ['comet', 'moon', 'star', 'sunflower'], odd: 'sunflower' },
  { tier: 3, prompt: 'Three of these are in a kitchen. Which one is not?', items: ['kettle', 'spoon', 'towel', 'compass'], odd: 'compass' },
];

export function oddPlan(level) {
  return { rounds: level <= FREE_LEVELS ? 4 : 5 };
}

/** Rounds for one board, easiest tiers first. */
export function pickOddRounds(level) {
  const { rounds } = oddPlan(level);
  const tiers = level <= 2 ? [1] : level <= 4 ? [1, 2] : level <= 6 ? [2, 3] : [1, 2, 3];
  const pool = shuffle(ODD_ROUNDS.filter((round) => tiers.includes(round.tier)));
  return pool.slice(0, rounds).map((round) => ({
    prompt: round.prompt,
    items: shuffle(round.items),
    odd: round.odd,
  }));
}

/* ----------------------------- Next in line ------------------------------ */

const PATTERN_SHAPES = ['disc', 'ring', 'triangle', 'diamond', 'square', 'bar', 'wand'];
const PATTERN_TONES = ['sage', 'ochre', 'rose', 'accent'];
const SHAPE_LABELS = {
  disc: 'circle',
  ring: 'ring',
  triangle: 'triangle',
  diamond: 'diamond',
  square: 'square',
  bar: 'line',
  wand: 'wand',
};
const TONE_LABELS = { sage: 'Sage', ochre: 'Ochre', rose: 'Rose', accent: 'Terracotta' };

const shapeSpec = (shape = pick(PATTERN_SHAPES), tone = pick(PATTERN_TONES), extra = {}) => ({
  shape,
  tone,
  count: extra.count || 1,
  rotate: extra.rotate || 0,
  scale: extra.scale || 1,
});

const specKey = (spec) =>
  `${spec.shape}|${spec.tone}|${spec.count || 1}|${spec.rotate || 0}|${spec.scale || 1}`;

export const patternPlan = (level) => {
  const advanced = level > FREE_LEVELS;
  const allowed =
    level <= 2
      ? ['alternate', 'cycle3', 'countUp']
      : level <= 4
        ? ['alternate', 'cycle3', 'countUp', 'toneCycle']
        : level <= 6
          ? ['alternate', 'cycle3', 'cycle4', 'countUp', 'toneCycle', 'rotate']
          : [
              'alternate',
              'cycle3',
              'cycle4',
              'countUp',
              'countDown',
              'toneCycle',
              'rotate',
              'sizeCycle',
              'mirror',
            ];
  return { rounds: advanced ? 5 : 4, length: advanced ? 5 : 4, allowed };
};

function variantPool(answer) {
  const pool = [];
  PATTERN_TONES.forEach((tone) => {
    if (tone !== answer.tone) pool.push({ ...answer, tone });
  });
  PATTERN_SHAPES.forEach((shape) => {
    if (shape === answer.shape) return;
    const next = { ...answer, shape };
    if (shape !== 'disc') next.count = 1;
    if (shape !== 'bar' && shape !== 'wand' && shape !== 'triangle') next.rotate = 0;
    pool.push(next);
  });
  if (answer.count > 1) {
    [2, 3, 4, 5, 6].forEach((count) => {
      if (count !== answer.count) pool.push({ ...answer, count });
    });
  }
  if (answer.rotate) {
    [0, 45, 90, 135, 180, 225, 270].forEach((rotate) => {
      if (rotate !== answer.rotate) pool.push({ ...answer, rotate });
    });
  }
  if (answer.scale !== 1) {
    [0.55, 0.8, 1.05].forEach((scale) => {
      if (scale !== answer.scale) pool.push({ ...answer, scale });
    });
  }
  return shuffle(pool);
}

function optionsFor(answer, extras = []) {
  const seen = new Set();
  const options = [];
  [...extras, answer, ...variantPool(answer)].forEach((spec) => {
    const key = specKey(spec);
    if (seen.has(key)) return;
    seen.add(key);
    options.push(spec);
  });
  const chosen = [options[0], options[1], options[2]];
  return shuffle(chosen);
}

function makeRound(family, length) {
  let sequence = [];
  let answer = null;
  let extras = [];

  if (family === 'alternate') {
    let a = shapeSpec();
    let b = shapeSpec();
    while (specKey(a) === specKey(b)) b = shapeSpec();
    sequence = Array.from({ length }, (_, index) => (index % 2 === 0 ? a : b));
    answer = length % 2 === 0 ? a : b;
    extras = [length % 2 === 0 ? b : a];
  } else if (family === 'cycle3' || family === 'cycle4') {
    const size = family === 'cycle3' ? 3 : 4;
    const cycle = [];
    while (cycle.length < size) {
      const next = shapeSpec();
      if (!cycle.some((item) => specKey(item) === specKey(next))) cycle.push(next);
    }
    const start = Math.floor(Math.random() * size);
    sequence = Array.from(
      { length },
      (_, index) => cycle[(start + index) % cycle.length]
    );
    answer = cycle[(start + length) % cycle.length];
    extras = [sequence[sequence.length - 1]];
  } else if (family === 'countUp' || family === 'countDown') {
    const tone = pick(PATTERN_TONES);
    const base = shapeSpec('disc', tone);
    if (family === 'countUp') {
      sequence = Array.from({ length }, (_, index) => ({ ...base, count: index + 1 }));
      answer = { ...base, count: length + 1 };
      extras = [{ ...base, count: length }];
    } else {
      const startCount = length + 1;
      sequence = Array.from(
        { length },
        (_, index) => ({ ...base, count: startCount - index })
      );
      answer = { ...base, count: 1 };
      extras = [{ ...base, count: 2 }, { ...base, count: 3 }];
    }
  } else if (family === 'toneCycle') {
    const shape = pick(['disc', 'ring', 'triangle', 'diamond', 'square']);
    const tones = shuffle(PATTERN_TONES).slice(0, 3);
    const cycle = tones.map((tone) => shapeSpec(shape, tone));
    sequence = Array.from(
      { length },
      (_, index) => cycle[index % cycle.length]
    );
    answer = cycle[length % cycle.length];
    extras = [sequence[sequence.length - 1]];
  } else if (family === 'rotate') {
    const shape = pick(['bar', 'wand', 'triangle']);
    const step = 45;
    const cycle = [0, 1, 2, 3, 4, 5, 6, 7].map((turn) =>
      shapeSpec(shape, 'ochre', { rotate: turn * step })
    );
    sequence = Array.from({ length }, (_, index) => cycle[index]);
    answer = cycle[length];
    extras = [sequence[sequence.length - 1]];
  } else if (family === 'sizeCycle') {
    const shape = pick(['disc', 'square', 'triangle', 'diamond', 'ring']);
    const tone = pick(PATTERN_TONES);
    const scales = [0.55, 0.8, 1.05];
    const cycle = scales.map((scale) => shapeSpec(shape, tone, { scale }));
    sequence = Array.from({ length }, (_, index) => cycle[index % 3]);
    answer = cycle[length % 3];
    extras = [sequence[sequence.length - 1]];
  } else {
    // mirror: A B C B A, next B
    let a = shapeSpec();
    let b = shapeSpec();
    let c = shapeSpec();
    while (specKey(a) === specKey(b)) b = shapeSpec();
    while (specKey(c) === specKey(a) || specKey(c) === specKey(b)) c = shapeSpec();
    const cycle = [a, b, c, b, a, b, c, b];
    sequence = cycle.slice(0, Math.max(5, length));
    answer = cycle[sequence.length];
    extras = [sequence[sequence.length - 1]];
  }

  const options = optionsFor(answer, extras);
  return {
    sequence,
    options,
    answerIndex: options.findIndex((option) => specKey(option) === specKey(answer)),
  };
}

export function buildPatternBoard(level) {
  const plan = patternPlan(level);
  const families = shuffle([...plan.allowed]);
  return Array.from({ length: plan.rounds }, (_, index) =>
    makeRound(families[index % families.length], plan.length)
  );
}

export function patternLabel(spec) {
  const count = spec.count || 1;
  const shape = count > 1 ? 'dots' : SHAPE_LABELS[spec.shape] || spec.shape;
  const size = spec.scale < 0.7 ? 'Small ' : spec.scale > 0.9 ? 'Large ' : '';
  const rotation = spec.rotate ? `, turned ${spec.rotate} degrees` : '';
  return `${TONE_LABELS[spec.tone]} ${size}${count > 1 ? `${count} ` : ''}${shape}${rotation}`;
}
