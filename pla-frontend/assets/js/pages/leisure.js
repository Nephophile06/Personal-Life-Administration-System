import { getLeisureState, saveLeisureState } from '../api.js';
import { icon } from '../icons.js';
import { pageHead } from '../ui/widgets.js';
import { pip, pipStamp } from '../mascot.js';
import { toast } from '../ui/toast.js';
import { openSheet } from '../ui/sheet.js';
import {
  FREE_LEVELS,
  MAX_LEVEL,
  PAIR_SYMBOLS,
  buildPatternBoard,
  buildWordBoard,
  pairPlan,
  patternLabel,
  pickOddRounds,
  trailPlan,
  trailWords,
} from '../leisure-data.js';

const GAME_IDS = ['pairs', 'lantern', 'words', 'trail', 'odd', 'pattern'];

const GAMES = {
  pairs: {
    title: 'Quiet pairs',
    eyebrow: 'A MEMORY GAME',
    kind: 'Memory',
    icon: 'leaf',
    minutes: '3–5 min',
    blurb: 'Cards face down, a handful of pairs to find. The board grows as you settle in.',
    how: [
      'Turn over two cards at a time.',
      'A matching pair stays open.',
      'Find every pair in as few turns as you can.',
    ],
    aside: 'There is no clock. A slow round is still a good round.',
  },
  lantern: {
    title: 'Lantern grid',
    eyebrow: 'A LIGHT PUZZLE',
    kind: 'Logic',
    icon: 'sun',
    minutes: '2–5 min',
    blurb: 'Tap a lantern and its neighbours change too. Wake every light in the grid.',
    how: [
      'Tapping a lamp flips it and the four lamps beside it.',
      'Unlit lamps are the puzzle, not a mistake.',
      'A nudge shows one useful tap if you want it.',
    ],
    aside: 'Every grid begins solvable. Nothing can be broken beyond repair.',
  },
  words: {
    title: 'Three by three',
    eyebrow: 'A WORD GAME',
    kind: 'Words',
    icon: 'book',
    minutes: '3–6 min',
    blurb: 'Loose words, quiet threads. Choose three that belong together.',
    how: [
      'Tap three words that share a theme.',
      'Correct groups settle above the board.',
      'After a miss, Puffy can show one thread.',
    ],
    aside: 'Words can be read slowly. There is no penalty for thinking.',
  },
  trail: {
    title: 'Letter trail',
    eyebrow: 'A WORD SEARCH',
    kind: 'Search',
    icon: 'search',
    minutes: '4–7 min',
    blurb: 'A soft grid of letters with a few words tucked into the rows.',
    how: [
      'Tap the first letter of a word, then its last.',
      'Words run across, down, or — later — on a slant.',
      'Found words settle into your list.',
    ],
    aside: 'A trail can double back. Reading backwards is allowed.',
  },
  odd: {
    title: 'One of these',
    eyebrow: 'AN ODD-ONE-OUT',
    kind: 'Noticing',
    icon: 'eye',
    minutes: '2–4 min',
    blurb: 'Four small things, one quiet difference. Choose the one that does not belong.',
    how: [
      'Read the prompt above the four choices.',
      'Tap the one that does not fit.',
      'A gentle miss simply leaves the other choices open.',
    ],
    aside: 'Noticing is a skill, not a race. Take the second look.',
  },
  pattern: {
    title: 'Next in line',
    eyebrow: 'A PATTERN GAME',
    kind: 'Pattern',
    icon: 'wand',
    minutes: '2–4 min',
    blurb: 'A short run of shapes and colours. Choose what comes next.',
    how: [
      'Look along the sequence for its small rhythm.',
      'Choose the tile that continues it.',
      'Wrong choices stay quiet and let you try again.',
    ],
    aside: 'Patterns are allowed to be simple. The noticing is the point.',
  },
};

const MISS_LINES = [
  'Not quite. Those three keep different company.',
  'A near miss. Try another thread.',
  'Still loose. The right three are close.',
  'A gentle miss. Nothing is lost.',
];

const TRAIL_MISS_LINES = [
  'No word on that line. The letters stay where they are.',
  'A gentle miss. Start the run again when you like.',
  'Not this trail. Try a different first letter.',
];

const shuffle = (list) => {
  const next = [...list];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
};

const clampLevel = (value) =>
  Math.min(MAX_LEVEL, Math.max(1, Math.floor(Number(value) || 1)));

const isPremium = (leisure) => Boolean(leisure?.premium?.unlocked);

const playableLevel = (leisure, id) => {
  const next = clampLevel(leisure?.[id]?.level ?? 1);
  return isPremium(leisure) ? next : Math.min(next, FREE_LEVELS);
};

function bestDetail(id, leisure) {
  const stat = leisure?.[id] || {};
  const cleared = Number(stat.cleared) || 0;
  const level = clampLevel(stat.level ?? 1);
  const premium = isPremium(leisure);
  const locked = level > FREE_LEVELS && !premium;
  const main =
    cleared >= MAX_LEVEL
      ? `All ${MAX_LEVEL} levels cleared`
      : locked
        ? 'All six free levels cleared'
        : `Level ${Math.min(level, MAX_LEVEL)}`;
  const sub = locked
    ? `Puffy Plus opens levels 7–${MAX_LEVEL}`
    : cleared
      ? `${cleared} level${cleared === 1 ? '' : 's'} cleared${premium ? ' · Plus open' : ''}`
      : 'Levels 1–6 are free';
  return { main, sub, cleared, level, locked };
}

function levelStrip(id, leisure, current = playableLevel(leisure, id)) {
  const stat = leisure?.[id] || {};
  const cleared = Number(stat.cleared) || 0;
  const premium = isPremium(leisure);
  const level = clampLevel(current);
  const dots = Array.from({ length: FREE_LEVELS }, (_, index) => {
    const n = index + 1;
    const state = n <= cleared ? 'is-cleared' : n === level ? 'is-current' : '';
    return `<span class="leisure-dot ${state}"></span>`;
  }).join('');
  const tag =
    level > FREE_LEVELS
      ? `${icon('sparkles', 12)} Puffy Plus`
      : premium
        ? 'Plus open'
        : 'Free levels 1–6';
  return `<span class="leisure-levelstrip__label">Level <strong>${level}</strong></span>
    <span class="leisure-levelstrip__dots" aria-hidden="true">${dots}</span>
    <span class="leisure-levelstrip__tag">${tag}</span>`;
}

function plusBanner(leisure) {
  if (isPremium(leisure)) {
    return `<div class="leisure-plus is-open">
      <div class="leisure-plus__copy">
        <span class="card-kicker">${icon('sparkles', 12)} PUFFY PLUS</span>
        <h2>All thirty-six levels are open.</h2>
        <p>Bigger boards, mixed sets, and one gentle unlock across all six games. Your progress stays on this device.</p>
      </div>
      <div class="leisure-plus__action">
        <span class="chip chip--ghost">${icon('check', 13)} Plus is open</span>
      </div>
    </div>`;
  }
  return `<div class="leisure-plus">
    <div class="leisure-plus__copy">
      <span class="card-kicker">${icon('sparkles', 12)} PUFFY PLUS</span>
      <h2>Thirty more quiet levels.</h2>
      <p>Six levels of every game are free. Puffy Plus opens levels 7–${MAX_LEVEL} with larger boards and mixed sets — one unlock, all six games.</p>
    </div>
    <div class="leisure-plus__action">
      <button class="btn btn--primary btn--sm" type="button" data-hub-unlock>
        ${icon('sparkles', 14)} Unlock in this demo
      </button>
      <span class="leisure-plus__note">No payment is taken in this demo build.</span>
    </div>
  </div>`;
}

function hubMarkup(leisure) {
  return `<section class="page leisure-page">
    ${pageHead({
      eyebrow: 'A SMALL PAUSE',
      title: 'Something gentle to do.',
      sub: 'No timers, no streak to keep. Six small games with six free levels each — for the minutes when you need somewhere soft to land.',
      actions: `<span class="chip chip--ghost">${icon('wifi-off', 14)} Works offline</span>`,
    })}
    <div class="leisure-hero">
      <div class="leisure-hero__mark">${pip({ mood: 'sleepy', size: 88, title: 'Puffy, resting' })}</div>
      <div class="leisure-hero__copy">
        <span class="card-kicker"><span class="pill-dot"></span> Five quiet minutes</span>
        <p>These are not tasks. Finish a board and a fresh one is set for the next level. Leave halfway if you like — nothing here will nag you.</p>
      </div>
    </div>
    <div class="leisure-grid">
      ${GAME_IDS.map((id) => {
        const game = GAMES[id];
        const best = bestDetail(id, leisure);
        const start = playableLevel(leisure, id);
        const cleared = Number(leisure?.[id]?.cleared) || 0;
        const cta = !cleared
          ? 'Begin level 1'
          : best.locked
            ? `Replay level ${start}`
            : `Continue level ${start}`;
        return `<article class="leisure-card">
          <div class="leisure-card__top">
            <span class="leisure-card__icon">${icon(game.icon, 23)}</span>
            <span class="leisure-card__kind">${game.kind} · ${game.minutes}</span>
          </div>
          <h2>${game.title}</h2>
          <p class="leisure-card__blurb">${game.blurb}</p>
          <div class="leisure-card__best">
            <strong>${best.main}</strong>
            <span>${best.sub}</span>
          </div>
          <a class="btn btn--ghost btn--block leisure-card__play" href="#/leisure?game=${id}">
            ${cta} ${icon('arrow-right', 14)}
          </a>
        </article>`;
      }).join('')}
    </div>
    ${plusBanner(leisure)}
    <div class="leisure-note">
      <span class="leisure-note__stamp">${pipStamp(42, 'sleepy')}</span>
      <p><strong>Gentle by design.</strong> No scores leave this device, no notifications interrupt a round, and every game can be finished later. Play for five minutes, then leave it here.</p>
    </div>
  </section>`;
}

function stageShell(id, leisure) {
  const game = GAMES[id];
  const best = bestDetail(id, leisure);
  return `<section class="page leisure-page leisure-page--game">
    <a class="leisure-back" href="#/leisure">${icon('arrow-left', 15)} All six games</a>
    ${pageHead({ eyebrow: game.eyebrow, title: game.title, sub: game.blurb })}
    <div class="leisure-levelstrip" data-levelstrip>${levelStrip(id, leisure)}</div>
    <div class="leisure-layout">
      <div class="leisure-stage" data-stage></div>
      <aside class="leisure-rail">
        <div class="card leisure-how">
          <span class="card-kicker">HOW TO PLAY</span>
          <ol>
            ${game.how.map((step) => `<li>${step}</li>`).join('')}
          </ol>
        </div>
        <div class="card card--quiet leisure-best">
          <span class="card-kicker">YOUR PROGRESS</span>
          <strong data-best-main>${best.main}</strong>
          <p data-best-sub>${best.sub}</p>
        </div>
        <div class="leisure-aside">
          ${pipStamp(38, 'sleepy')}
          <p>${game.aside}</p>
        </div>
      </aside>
    </div>
  </section>`;
}

function clearTimers(page) {
  page.timers.forEach((timer) => clearTimeout(timer));
  page.timers.clear();
}

function later(page, fn, ms) {
  const timer = setTimeout(() => {
    page.timers.delete(timer);
    fn();
  }, ms);
  page.timers.add(timer);
  return timer;
}

function paintBest(page, id) {
  const best = bestDetail(id, page.leisure);
  const main = page.root.querySelector('[data-best-main]');
  const sub = page.root.querySelector('[data-best-sub]');
  if (main) main.textContent = best.main;
  if (sub) sub.textContent = best.sub;
}

function paintLevelStrip(page, id) {
  const strip = page.root.querySelector('[data-levelstrip]');
  if (strip) strip.innerHTML = levelStrip(id, page.leisure, page.level);
}

async function recordResult(page, id, patch) {
  try {
    page.leisure = await saveLeisureState({ [id]: patch });
    paintBest(page, id);
  } catch {
    page.leisure = {
      ...page.leisure,
      [id]: { ...(page.leisure?.[id] || {}), ...patch },
    };
    paintBest(page, id);
    toast('That round could not be saved, but it still counted.', { type: 'error' });
  }
  return page.leisure;
}

async function recordWin(page, id, level, patch = {}) {
  const base = page.leisure?.[id] || {};
  const cleared = Math.max(Number(base.cleared) || 0, level);
  const next = Math.min(MAX_LEVEL, Math.max(Number(base.level) || 1, level + 1));
  return recordResult(page, id, { ...patch, cleared, level: next });
}

function focusResult(page) {
  const heading = page.root.querySelector('[data-result] h2');
  if (!heading) return;
  heading.setAttribute('tabindex', '-1');
  heading.focus({ preventScroll: true });
}

function resultActions(level, locked) {
  const maxed = level >= MAX_LEVEL;
  const next = Math.min(MAX_LEVEL, level + 1);
  if (maxed) {
    return `<button class="btn btn--ghost btn--sm" type="button" data-again>Replay level ${level}</button>
      <a class="linkish" href="#/leisure">All games ${icon('arrow-right', 13)}</a>`;
  }
  if (locked) {
    return `<button class="btn btn--primary btn--sm" type="button" data-unlock>
        ${icon('sparkles', 14)} Unlock levels 7+
      </button>
      <button class="btn btn--ghost btn--sm" type="button" data-again>Replay level ${level}</button>
      <a class="linkish" href="#/leisure">All games ${icon('arrow-right', 13)}</a>`;
  }
  return `<button class="btn btn--primary btn--sm" type="button" data-next>
      Next level ${next} ${icon('arrow-right', 14)}
    </button>
    <button class="btn btn--ghost btn--sm" type="button" data-again>Replay level ${level}</button>
    <a class="linkish" href="#/leisure">All games ${icon('arrow-right', 13)}</a>`;
}

function gateMarkup(level) {
  return `<div class="leisure-gate">
    <span class="leisure-gate__badge">${icon('sparkles', 14)} PUFFY PLUS</span>
    <h3>Six free levels, cleared.</h3>
    <p>Levels 7–${MAX_LEVEL} hold larger boards and mixed sets across all six games. One unlock opens every one of them on this device.</p>
    <div class="leisure-gate__actions">
      <button class="btn btn--ghost btn--sm" type="button" data-again>Replay level ${level}</button>
      <a class="linkish" href="#/leisure">All games ${icon('arrow-right', 13)}</a>
    </div>
    <span class="leisure-gate__note">Demo build: this unlocks locally. No card, account, or payment is taken.</span>
  </div>`;
}

function renderResult(page, id, { level, iconName, title, detail, locked }) {
  const slot = page.root.querySelector('[data-result]');
  if (!slot) return;
  slot.innerHTML = `<div class="leisure-result">
    <span class="leisure-result__mark">${icon(iconName, 22)}</span>
    <div>
      <h2>${title}</h2>
      <p>Level ${level}. ${detail}</p>
    </div>
    <div class="leisure-result__actions">
      ${resultActions(level, locked)}
    </div>
  </div>${locked ? gateMarkup(level) : ''}`;
  slot.querySelector('[data-next]')?.addEventListener('click', () => {
    page.start(id, Math.min(MAX_LEVEL, level + 1));
  });
  slot.querySelectorAll('[data-again]').forEach((button) => {
    button.addEventListener('click', () => page.start(id, level));
  });
  slot.querySelectorAll('[data-unlock]').forEach((button) => {
    button.addEventListener('click', () => {
      openPremium(page, () => page.start(id, Math.min(MAX_LEVEL, level + 1)));
    });
  });
  focusResult(page);
}

function openPremium(page, afterUnlock) {
  const sheet = openSheet({
    eyebrow: 'PUFFY PLUS',
    title: 'Thirty more quiet levels.',
    subtitle: 'One unlock for all six games — levels 7 to 36.',
    initialFocus: '[data-plus-unlock]',
    body: `<div class="plus-sheet">
      <ul class="plus-list">
        <li><strong>Larger boards</strong><span>Memory decks grow to twelve pairs, lanterns to five by five, and word trails to nine by nine.</span></li>
        <li><strong>Mixed sets</strong><span>Word groups are drawn from different boards, so every level feels newly assembled.</span></li>
        <li><strong>Fresh patterns</strong><span>New sequences, rotations, and counts continue well past the free six.</span></li>
        <li><strong>Still calm</strong><span>No timers, no ads, no streak to keep. Progress stays on this device.</span></li>
      </ul>
      <p class="plus-note">This is a demo build. Unlocking here only opens the extra levels in this browser — no card, account, or payment is taken.</p>
    </div>`,
    footer: `<button class="btn btn--primary" type="button" data-plus-unlock>
        ${icon('sparkles', 15)} Unlock in this demo
      </button>
      <button class="btn btn--ghost" type="button" data-close>Not now</button>`,
  });

  const unlock = sheet.footer?.querySelector('[data-plus-unlock]');
  unlock?.addEventListener('click', async () => {
    unlock.disabled = true;
    unlock.textContent = 'Opening…';
    try {
      page.leisure = await saveLeisureState({
        premium: {
          unlocked: true,
          since: new Date().toISOString(),
          source: 'demo',
        },
      });
      paintBest(page, page.activeId || 'pairs');
      sheet.close();
      toast('Puffy Plus is open. Levels 7–36 are yours on this device.');
      afterUnlock?.();
    } catch {
      unlock.disabled = false;
      unlock.textContent = 'Unlock in this demo';
      toast('The unlock could not be saved. Try again in a moment.', { type: 'error' });
    }
  });
}

/* ------------------------------ Quiet pairs ------------------------------ */

function mountPairs(page) {
  clearTimers(page);
  const stage = page.root.querySelector('[data-stage]');
  if (!stage) return;
  page.activeId = 'pairs';

  const level = page.level;
  const plan = pairPlan(level);
  const total = plan.pairs;
  const columns = total >= 9 ? 6 : 4;
  const deck = shuffle(
    shuffle(PAIR_SYMBOLS)
      .slice(0, total)
      .flatMap((symbol, pair) => [{ ...symbol, pair }, { ...symbol, pair }])
  ).map((card, index) => ({ ...card, index, matched: false }));

  const game = {
    deck,
    open: [],
    moves: 0,
    matched: 0,
    locked: false,
    done: false,
    saved: false,
  };

  stage.innerHTML = `
    <div class="leisure-stage__bar">
      <div class="leisure-counters">
        <span class="leisure-counter"><strong data-moves>0</strong><small>turns</small></span>
        <span class="leisure-counter"><strong data-pairs>0</strong><small>of ${total} pairs</small></span>
      </div>
      <button class="btn btn--ghost btn--sm" type="button" data-reset>${icon('refresh', 14)} New deck</button>
    </div>
    <p class="leisure-status" data-status role="status" aria-live="polite">Level ${level} · ${total} pairs. Two cards at a time.</p>
    <div class="pairs-board" data-pairs-board data-cols="${columns}" role="group" aria-label="${total * 2} cards, ${total} pairs">
      ${deck
        .map(
          (card) => `<button class="pair-card" type="button" data-pair="${card.index}"
            aria-label="Hidden card ${card.index + 1}">
            <span class="pair-card__face pair-card__back" aria-hidden="true">${icon('leaf', 18)}</span>
            <span class="pair-card__face pair-card__front" aria-hidden="true">
              ${icon(card.icon, 25)}
              <span>${card.label}</span>
            </span>
          </button>`
        )
        .join('')}
    </div>
    <div class="leisure-result-slot" data-result></div>
  `;

  const board = stage.querySelector('[data-pairs-board]');
  const status = stage.querySelector('[data-status]');
  const movesEl = stage.querySelector('[data-moves]');
  const pairsEl = stage.querySelector('[data-pairs]');

  const setStatus = (text) => {
    status.textContent = text;
  };

  const finish = async () => {
    if (game.done) return;
    game.done = true;
    const bestMoves = game.moves;
    await recordWin(page, 'pairs', level, {
      plays: (Number(page.leisure.pairs?.plays) || 0) + 1,
      wins: (Number(page.leisure.pairs?.wins) || 0) + 1,
      bestMoves:
        page.leisure.pairs?.bestMoves == null
          ? bestMoves
          : Math.min(Number(page.leisure.pairs.bestMoves), bestMoves),
    });
    const detail = `${game.moves} turn${game.moves === 1 ? '' : 's'} this time.`;
    renderResult(page, 'pairs', {
      level,
      iconName: 'sparkles',
      title: 'All pairs found.',
      detail,
      locked: level >= FREE_LEVELS && !isPremium(page.leisure),
    });
    setStatus('Every pair found. Nothing else to do for a moment.');
    focusResult(page);
  };

  const flipBack = (indices) => {
    indices.forEach((index) => {
      const card = game.deck[index];
      const button = board.querySelector(`[data-pair="${index}"]`);
      if (!button || card.matched) return;
      button.classList.remove('is-flipped');
      button.setAttribute('aria-label', `Hidden card ${index + 1}`);
    });
  };

  board.addEventListener('click', (event) => {
    const button = event.target.closest('[data-pair]');
    if (!button || game.locked || game.done) return;
    const index = Number(button.dataset.pair);
    const card = game.deck[index];
    if (card.matched || game.open.includes(index)) return;

    button.classList.add('is-flipped');
    button.setAttribute('aria-label', `${card.label}, face up`);
    game.open.push(index);

    if (game.open.length < 2) {
      setStatus('One card turned. Choose its partner.');
      return;
    }

    game.locked = true;
    game.moves += 1;
    movesEl.textContent = game.moves;
    const [first, second] = game.open;
    const a = game.deck[first];
    const b = game.deck[second];

    if (a.pair === b.pair) {
      later(page, () => {
        [first, second].forEach((i) => {
          const item = game.deck[i];
          const el = board.querySelector(`[data-pair="${i}"]`);
          item.matched = true;
          if (!el) return;
          el.classList.add('is-matched');
          el.setAttribute('aria-label', `${item.label}, matched`);
          el.setAttribute('aria-disabled', 'true');
        });
        game.open = [];
        game.matched += 1;
        game.locked = false;
        pairsEl.textContent = game.matched;
        setStatus(
          game.matched === total
            ? 'Every pair found.'
            : `${a.label} matches. ${total - game.matched} pair${total - game.matched === 1 ? '' : 's'} left.`
        );
        if (game.matched === total) finish();
      }, 460);
    } else {
      later(page, () => {
        flipBack([first, second]);
        game.open = [];
        game.locked = false;
        setStatus('Not a pair. Let them turn back, then try again.');
      }, 820);
    }
  });

  stage.querySelector('[data-reset]')?.addEventListener('click', () => page.start('pairs', level));
}

/* ------------------------------ Lantern grid ----------------------------- */

function lanternMasks(size) {
  return Array.from({ length: size * size }, (_, index) => {
    const row = Math.floor(index / size);
    const col = index % size;
    let mask = 1 << index;
    if (row > 0) mask |= 1 << (index - size);
    if (row < size - 1) mask |= 1 << (index + size);
    if (col > 0) mask |= 1 << (index - 1);
    if (col < size - 1) mask |= 1 << (index + 1);
    return mask;
  });
}

const popcount = (value) => {
  let n = value;
  let count = 0;
  while (n) {
    n &= n - 1;
    count += 1;
  }
  return count;
};

/** One shortest-style solution via GF(2): returns tap indices, or []. */
function lanternSolution(mask, size) {
  const n = size * size;
  const full = (1 << n) - 1;
  const masks = lanternMasks(size);
  const target = mask ^ full;
  if (!target) return [];

  const rows = [];
  for (let cell = 0; cell < n; cell += 1) {
    let row = 0;
    for (let i = 0; i < n; i += 1) {
      if (masks[i] & (1 << cell)) row |= 1 << i;
    }
    if (target & (1 << cell)) row |= 1 << n;
    rows.push(row);
  }

  const where = new Array(n).fill(-1);
  let pivot = 0;
  for (let col = 0; col < n && pivot < rows.length; col += 1) {
    let selected = -1;
    for (let r = pivot; r < rows.length; r += 1) {
      if (rows[r] & (1 << col)) {
        selected = r;
        break;
      }
    }
    if (selected < 0) continue;
    [rows[pivot], rows[selected]] = [rows[selected], rows[pivot]];
    for (let r = 0; r < rows.length; r += 1) {
      if (r !== pivot && rows[r] & (1 << col)) rows[r] ^= rows[pivot];
    }
    where[col] = pivot;
    pivot += 1;
  }

  for (let r = 0; r < rows.length; r += 1) {
    if (!(rows[r] & full) && ((rows[r] >> n) & 1)) return [];
  }

  const particular = new Array(n).fill(0);
  for (let col = 0; col < n; col += 1) {
    if (where[col] >= 0) particular[col] = (rows[where[col]] >> n) & 1;
  }

  const freeCols = [];
  for (let col = 0; col < n; col += 1) if (where[col] < 0) freeCols.push(col);

  const basis = freeCols.map((free) => {
    const vector = new Array(n).fill(0);
    vector[free] = 1;
    for (let col = 0; col < n; col += 1) {
      if (where[col] < 0) continue;
      let value = 0;
      freeCols.forEach((k) => {
        if (rows[where[col]] & (1 << k)) value ^= vector[k];
      });
      vector[col] = value;
    }
    return vector;
  });

  let best = particular;
  let bestCount = popcount(best.reduce((sum, bit, i) => (bit ? sum | (1 << i) : sum), 0));
  if (freeCols.length <= 12) {
    for (let bits = 0; bits < 1 << freeCols.length; bits += 1) {
      const vector = [...particular];
      for (let b = 0; b < freeCols.length; b += 1) {
        if (!(bits & (1 << b))) continue;
        for (let i = 0; i < n; i += 1) vector[i] ^= basis[b][i];
      }
      const count = vector.reduce((sum, bit) => sum + bit, 0);
      if (count < bestCount) {
        best = vector;
        bestCount = count;
      }
    }
  }

  return best
    .map((bit, index) => (bit ? index : -1))
    .filter((index) => index >= 0);
}

function lanternPuzzle(size, level) {
  const masks = lanternMasks(size);
  const full = (1 << (size * size)) - 1;
  const taps = size === 3 ? 2 + Math.min(level, 2) : size === 4 ? 4 + Math.floor(level / 2) : 6 + Math.floor(level / 2);
  for (let attempt = 0; attempt < 40; attempt += 1) {
    let mask = full;
    for (let i = 0; i < taps; i += 1) {
      mask ^= masks[Math.floor(Math.random() * masks.length)];
    }
    if (mask !== full) return mask;
  }
  return full ^ masks[Math.floor(masks.length / 2)];
}

function mountLantern(page) {
  clearTimers(page);
  const stage = page.root.querySelector('[data-stage]');
  if (!stage) return;
  page.activeId = 'lantern';

  const level = page.level;
  const size = level <= 2 ? 3 : level <= 6 ? 4 : 5;
  const n = size * size;
  const full = (1 << n) - 1;
  const masks = lanternMasks(size);

  const game = {
    mask: lanternPuzzle(size, level),
    moves: 0,
    done: false,
    saved: false,
    hinted: -1,
    hintTimer: null,
  };

  stage.innerHTML = `
    <div class="leisure-stage__bar">
      <div class="leisure-counters">
        <span class="leisure-counter"><strong data-moves>0</strong><small>moves</small></span>
        <span class="leisure-counter"><strong data-awake>0</strong><small>of ${n} awake</small></span>
      </div>
      <button class="btn btn--ghost btn--sm" type="button" data-reset>${icon('refresh', 14)} New grid</button>
    </div>
    <p class="leisure-status" data-status role="status" aria-live="polite">Level ${level} · ${size} by ${size}. Wake every lantern.</p>
    <div class="lantern-board" data-lantern-board data-size="${size}" style="--lantern-cols:${size}"
      role="group" aria-label="${size} by ${size} lantern grid">
      ${Array.from({ length: n }, (_, index) => `<button class="lantern" type="button" data-lantern="${index}"
        aria-pressed="false" aria-label="Lamp row ${Math.floor(index / size) + 1}, column ${(index % size) + 1}, unlit">
        <span class="lantern__handle" aria-hidden="true"></span>
        <span class="lantern__body" aria-hidden="true"><span class="lantern__flame"></span></span>
      </button>`).join('')}
    </div>
    <div class="leisure-stage__foot">
      <p class="leisure-foot-note">A nudge is free. It only points; you still make the move.</p>
      <button class="linkish" type="button" data-hint>${icon('sparkles', 13)} Show me one tap</button>
    </div>
    <div class="leisure-result-slot" data-result></div>
  `;

  const board = stage.querySelector('[data-lantern-board]');
  const status = stage.querySelector('[data-status]');
  const movesEl = stage.querySelector('[data-moves]');
  const awakeEl = stage.querySelector('[data-awake]');

  const awake = (mask) => popcount(mask);

  const paint = () => {
    board.querySelectorAll('[data-lantern]').forEach((button) => {
      const index = Number(button.dataset.lantern);
      const lit = Boolean(game.mask & (1 << index));
      button.classList.toggle('is-lit', lit);
      button.setAttribute('aria-pressed', String(lit));
      button.setAttribute(
        'aria-label',
        `Lamp row ${Math.floor(index / size) + 1}, column ${(index % size) + 1}, ${lit ? 'lit' : 'unlit'}`
      );
    });
    movesEl.textContent = game.moves;
    awakeEl.textContent = awake(game.mask);
  };

  const clearHint = () => {
    if (game.hintTimer) {
      clearTimeout(game.hintTimer);
      page.timers.delete(game.hintTimer);
      game.hintTimer = null;
    }
    board.querySelectorAll('.is-hinted').forEach((el) => el.classList.remove('is-hinted'));
    game.hinted = -1;
  };

  const finish = async () => {
    if (game.done) return;
    game.done = true;
    clearHint();
    await recordWin(page, 'lantern', level, {
      plays: (Number(page.leisure.lantern?.plays) || 0) + 1,
      wins: (Number(page.leisure.lantern?.wins) || 0) + 1,
      bestMoves:
        page.leisure.lantern?.bestMoves == null
          ? game.moves
          : Math.min(Number(page.leisure.lantern.bestMoves), game.moves),
    });
    const detail = `${game.moves} move${game.moves === 1 ? '' : 's'} this time.`;
    renderResult(page, 'lantern', {
      level,
      iconName: 'sun',
      title: 'Every lantern is awake.',
      detail,
      locked: level >= FREE_LEVELS && !isPremium(page.leisure),
    });
    status.textContent = 'All lamps are lit. The room can go quiet again.';
    paint();
    focusResult(page);
  };

  board.addEventListener('click', (event) => {
    const button = event.target.closest('[data-lantern]');
    if (!button || game.done) return;
    clearHint();
    const index = Number(button.dataset.lantern);
    game.mask ^= masks[index];
    game.moves += 1;
    paint();
    if (game.mask === full) {
      finish();
    } else {
      status.textContent = `${awake(game.mask)} of ${n} lamps are awake.`;
    }
  });

  stage.querySelector('[data-hint]')?.addEventListener('click', () => {
    if (game.done) return;
    const taps = lanternSolution(game.mask, size);
    if (!taps.length) {
      status.textContent = 'Every lamp is already awake.';
      return;
    }
    const index = taps[Math.floor(Math.random() * Math.min(3, taps.length))];
    clearHint();
    const button = board.querySelector(`[data-lantern="${index}"]`);
    if (!button) return;
    game.hinted = index;
    button.classList.add('is-hinted');
    status.textContent = `Try the lamp with the soft ring — row ${Math.floor(index / size) + 1}, column ${(index % size) + 1}.`;
    game.hintTimer = later(page, () => {
      button.classList.remove('is-hinted');
      game.hinted = -1;
      game.hintTimer = null;
    }, 2600);
  });

  stage.querySelector('[data-reset]')?.addEventListener('click', () => page.start('lantern', level));
  paint();
}

/* ----------------------------- Three by three ---------------------------- */

function mountWords(page) {
  clearTimers(page);
  const stage = page.root.querySelector('[data-stage]');
  if (!stage) return;
  page.activeId = 'words';

  const level = page.level;
  const board = buildWordBoard(level);
  const groupCount = board.groups.length;
  const game = {
    groups: board.groups.map((group, id) => ({ ...group, id, found: false })),
    words: shuffle(
      board.groups.flatMap((group, groupId) =>
        group.words.map((word) => ({ word, groupId }))
      )
    ),
    selected: [],
    misses: 0,
    hints: 0,
    done: false,
    saved: false,
  };

  stage.innerHTML = `
    <div class="leisure-stage__bar">
      <div class="leisure-counters">
        <span class="leisure-counter"><strong data-found-count>0</strong><small>of ${groupCount} threads</small></span>
        <span class="leisure-counter"><strong data-misses>0</strong><small>gentle misses</small></span>
      </div>
      <button class="btn btn--ghost btn--sm" type="button" data-reset>${icon('refresh', 14)} New board</button>
    </div>
    <p class="leisure-status" data-status role="status" aria-live="polite" tabindex="-1">Level ${level}${board.mixed ? ' · mixed threads' : ''}. Choose three words that belong together.</p>
    <div class="word-found" data-word-found></div>
    <div class="word-board" data-word-board role="group" aria-label="${groupCount * 3} words to group into ${groupCount} sets"></div>
    <div class="word-actions">
      <p class="word-actions__note" data-word-note>Three at a time. A wrong guess is only a pause.</p>
      <div class="word-actions__buttons">
        <button class="btn btn--primary btn--sm" type="button" data-word-check disabled>Check three</button>
        <button class="btn btn--ghost btn--sm" type="button" data-word-clear disabled>Clear</button>
        <button class="linkish" type="button" data-word-hint>${icon('sparkles', 13)} Show me one</button>
      </div>
    </div>
    <div class="leisure-result-slot" data-result></div>
  `;

  const wordBoard = stage.querySelector('[data-word-board]');
  const foundBox = stage.querySelector('[data-word-found]');
  const status = stage.querySelector('[data-status]');
  const note = stage.querySelector('[data-word-note]');
  const checkBtn = stage.querySelector('[data-word-check]');
  const clearBtn = stage.querySelector('[data-word-clear]');
  const foundEl = stage.querySelector('[data-found-count]');
  const missesEl = stage.querySelector('[data-misses]');

  const foundGroups = () => game.groups.filter((group) => group.found);
  const remaining = () => game.groups.filter((group) => !group.found);

  const updateActions = () => {
    checkBtn.disabled = game.selected.length !== 3 || game.done;
    clearBtn.disabled = game.selected.length === 0 || game.done;
    note.textContent =
      game.selected.length === 3
        ? 'All three chosen. Check the thread when you are ready.'
        : game.selected.length
          ? `${game.selected.length} of 3 chosen.`
          : 'Three at a time. A wrong guess is only a pause.';
  };

  const paintFound = () => {
    const groups = foundGroups();
    foundBox.innerHTML = groups
      .map(
        (group) => `<div class="word-found__row" data-tone="${group.id % 3}">
          <span class="word-found__dot" aria-hidden="true"></span>
          <span class="word-found__name">${group.name}</span>
          <span class="word-found__words">${group.words.join(' · ')}</span>
        </div>`
      )
      .join('');
    foundEl.textContent = groups.length;
  };

  const paintWords = () => {
    const foundIds = new Set(foundGroups().map((group) => group.id));
    const words = game.words.filter((entry) => !foundIds.has(entry.groupId));
    wordBoard.innerHTML = words
      .map(
        (entry) => `<button class="word-tile" type="button" data-word="${entry.word}"
          aria-pressed="${game.selected.includes(entry.word)}"
          aria-label="${entry.word}">${entry.word}</button>`
      )
      .join('');
    wordBoard.querySelectorAll('[data-word]').forEach((button) => {
      button.classList.toggle('is-selected', game.selected.includes(button.dataset.word));
    });
    missesEl.textContent = game.misses;
    updateActions();
  };

  const finish = async () => {
    if (game.done) return;
    game.done = true;
    const perfect = game.misses === 0 && game.hints === 0;
    await recordWin(page, 'words', level, {
      plays: (Number(page.leisure.words?.plays) || 0) + 1,
      wins: (Number(page.leisure.words?.wins) || 0) + 1,
      bestMisses:
        page.leisure.words?.bestMisses == null
          ? game.misses
          : Math.min(Number(page.leisure.words.bestMisses), game.misses),
      perfect: (Number(page.leisure.words?.perfect) || 0) + (perfect ? 1 : 0),
    });
    const detail = perfect
      ? 'No misses and no nudges — every thread settled cleanly.'
      : `${game.misses} gentle miss${game.misses === 1 ? '' : 'es'}${game.hints ? ` and ${game.hints} nudge${game.hints === 1 ? '' : 's'}` : ''}. Every thread settled in the end.`;
    renderResult(page, 'words', {
      level,
      iconName: 'book',
      title: `${groupCount} threads, found.`,
      detail,
      locked: level >= FREE_LEVELS && !isPremium(page.leisure),
    });
    paintFound();
    paintWords();
    stage.querySelector('.word-actions')?.setAttribute('hidden', '');
    status.textContent = 'Every thread is settled.';
    focusResult(page);
  };

  wordBoard.addEventListener('click', (event) => {
    const button = event.target.closest('[data-word]');
    if (!button || game.done) return;
    const word = button.dataset.word;
    if (game.selected.includes(word)) {
      game.selected = game.selected.filter((item) => item !== word);
    } else if (game.selected.length >= 3) {
      status.textContent = 'Three at a time. Clear one before choosing another.';
      return;
    } else {
      game.selected.push(word);
    }
    button.classList.toggle('is-selected', game.selected.includes(word));
    button.setAttribute('aria-pressed', String(game.selected.includes(word)));
    updateActions();
    status.textContent =
      game.selected.length === 3
        ? 'Three chosen. Check them when you are ready.'
        : 'Choose three words that belong together.';
  });

  const reveal = (group) => {
    group.found = true;
    game.selected = [];
    paintFound();
    paintWords();
    status.textContent = `Puffy set aside “${group.name}”: ${group.words.join(', ')}.`;
    if (remaining().length === 0) finish();
  };

  checkBtn.addEventListener('click', () => {
    if (game.done || game.selected.length !== 3) return;
    const chosen = game.selected.map((word) => game.words.find((entry) => entry.word === word));
    const groupId = chosen[0]?.groupId;
    const sameGroup = chosen.every((entry) => entry?.groupId === groupId);
    game.selected = [];
    if (sameGroup) {
      const group = game.groups.find((item) => item.id === groupId);
      if (!group) return;
      group.found = true;
      paintFound();
      paintWords();
      status.textContent = `${group.name} — a thread found.`;
      status.focus({ preventScroll: true });
      if (remaining().length === 0) finish();
    } else {
      game.misses += 1;
      paintWords();
      status.textContent = MISS_LINES[(game.misses - 1) % MISS_LINES.length];
      status.focus({ preventScroll: true });
    }
  });

  clearBtn.addEventListener('click', () => {
    game.selected = [];
    paintWords();
    status.textContent = 'Cleared. Choose three again.';
  });

  stage.querySelector('[data-word-hint]')?.addEventListener('click', () => {
    if (game.done) return;
    const open = remaining();
    if (!open.length) return;
    const group = open[Math.floor(Math.random() * open.length)];
    game.hints += 1;
    reveal(group);
  });

  stage.querySelector('[data-reset]')?.addEventListener('click', () => page.start('words', level));
  paintFound();
  paintWords();
}

/* ------------------------------ Letter trail ----------------------------- */

function buildTrail(size, words, plan) {
  const dirs = [[0, 1], [1, 0]];
  if (plan.diagonals) dirs.push([1, 1], [1, -1]);
  const directed = plan.reverse
    ? dirs.flatMap(([dr, dc]) => [[dr, dc], [-dr, -dc]])
    : dirs;
  const alphabet = 'aaabbccddeeeeffgghiijkllmmnnnooopprrsssttuuuvwyy';

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const grid = Array.from({ length: size }, () => Array(size).fill(''));
    const placements = [];
    let ok = true;
    for (const word of shuffle(words)) {
      const options = [];
      directed.forEach(([dr, dc]) => {
        for (let r = 0; r < size; r += 1) {
          for (let c = 0; c < size; c += 1) {
            const endR = r + dr * (word.length - 1);
            const endC = c + dc * (word.length - 1);
            if (endR < 0 || endR >= size || endC < 0 || endC >= size) continue;
            let fits = true;
            for (let k = 0; k < word.length; k += 1) {
              const cell = grid[r + dr * k][c + dc * k];
              if (cell && cell !== word[k]) {
                fits = false;
                break;
              }
            }
            if (fits) options.push({ r, c, dr, dc });
          }
        }
      });
      if (!options.length) {
        ok = false;
        break;
      }
      const spot = options[Math.floor(Math.random() * options.length)];
      const cells = [];
      for (let k = 0; k < word.length; k += 1) {
        const r = spot.r + spot.dr * k;
        const c = spot.c + spot.dc * k;
        grid[r][c] = word[k];
        cells.push(r * size + c);
      }
      placements.push({ word, cells });
    }
    if (!ok) continue;
    for (let r = 0; r < size; r += 1) {
      for (let c = 0; c < size; c += 1) {
        if (!grid[r][c]) grid[r][c] = alphabet[Math.floor(Math.random() * alphabet.length)];
      }
    }
    return { grid, placements };
  }

  // A guaranteed fallback: one word per row.
  const grid = Array.from({ length: size }, () => Array(size).fill(''));
  const placements = [];
  words.slice(0, size).forEach((word, row) => {
    const cells = [];
    for (let k = 0; k < word.length; k += 1) {
      grid[row][k] = word[k];
      cells.push(row * size + k);
    }
    placements.push({ word, cells });
  });
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      if (!grid[r][c]) grid[r][c] = alphabet[Math.floor(Math.random() * alphabet.length)];
    }
  }
  return { grid, placements };
}

function mountTrail(page) {
  clearTimers(page);
  const stage = page.root.querySelector('[data-stage]');
  if (!stage) return;
  page.activeId = 'trail';

  const level = page.level;
  const plan = trailPlan(level);
  const words = trailWords(level, plan.count, plan.size);
  const puzzle = buildTrail(plan.size, words, plan);
  const size = plan.size;

  const game = {
    words,
    puzzle,
    start: null,
    found: new Set(),
    misses: 0,
    hints: 0,
    done: false,
    hintTimer: null,
  };

  stage.innerHTML = `
    <div class="leisure-stage__bar">
      <div class="leisure-counters">
        <span class="leisure-counter"><strong data-trail-found>0</strong><small>of ${words.length} words</small></span>
        <span class="leisure-counter"><strong data-trail-misses>0</strong><small>gentle misses</small></span>
      </div>
      <button class="btn btn--ghost btn--sm" type="button" data-reset>${icon('refresh', 14)} New grid</button>
    </div>
    <p class="leisure-status" data-status role="status" aria-live="polite">Level ${level} · ${words.length} words in a ${size} by ${size} grid. Tap a first letter, then its last.</p>
    <div class="trail-words" data-trail-words aria-label="Words to find">
      ${words.map((word, index) => `<span class="trail-word" data-trail-word="${word}" data-tone="${index % 3}">
        <span class="trail-word__dot" aria-hidden="true"></span>${word}
      </span>`).join('')}
    </div>
    <div class="trail-board" data-trail-board data-size="${size}" style="--trail-size:${size}" role="group" aria-label="${size} by ${size} word search">
      ${puzzle.grid
        .flatMap((row, r) =>
          row.map(
            (letter, c) => `<button class="trail-cell" type="button" data-cell="${r * size + c}"
              data-letter="${letter}" aria-label="Row ${r + 1}, column ${c + 1}: ${letter}">${letter}</button>`
          )
        )
        .join('')}
    </div>
    <div class="leisure-stage__foot">
      <p class="leisure-foot-note">Words may read backwards. A nudge points to one still hidden.</p>
      <button class="linkish" type="button" data-trail-hint>${icon('sparkles', 13)} Show me one</button>
    </div>
    <div class="leisure-result-slot" data-result></div>
  `;

  const board = stage.querySelector('[data-trail-board]');
  const status = stage.querySelector('[data-status]');
  const foundEl = stage.querySelector('[data-trail-found]');
  const missesEl = stage.querySelector('[data-trail-misses]');

  const letterAt = (index) => puzzle.grid[Math.floor(index / size)][index % size];
  const buttonAt = (index) => board.querySelector(`[data-cell="${index}"]`);

  const clearStart = () => {
    if (game.start != null) buttonAt(game.start)?.classList.remove('is-start');
    game.start = null;
  };

  const clearHint = () => {
    if (game.hintTimer) {
      clearTimeout(game.hintTimer);
      page.timers.delete(game.hintTimer);
      game.hintTimer = null;
    }
    board.querySelectorAll('.is-hinted').forEach((el) => el.classList.remove('is-hinted'));
  };

  const lineBetween = (from, to) => {
    const r1 = Math.floor(from / size);
    const c1 = from % size;
    const r2 = Math.floor(to / size);
    const c2 = to % size;
    const dr = Math.sign(r2 - r1);
    const dc = Math.sign(c2 - c1);
    if (!(dr === 0 || dc === 0 || Math.abs(dr) === Math.abs(dc))) return null;
    const length = Math.max(Math.abs(r2 - r1), Math.abs(c2 - c1)) + 1;
    const cells = [];
    let text = '';
    for (let k = 0; k < length; k += 1) {
      const r = r1 + dr * k;
      const c = c1 + dc * k;
      cells.push(r * size + c);
      text += puzzle.grid[r][c];
    }
    return { cells, text };
  };

  const markFound = (word, cells) => {
    game.found.add(word);
    cells.forEach((index) => buttonAt(index)?.classList.add('is-found'));
    const chip = stage.querySelector(`[data-trail-word="${word}"]`);
    chip?.classList.add('is-found');
    foundEl.textContent = game.found.size;
    status.textContent = `“${word}” found. ${words.length - game.found.size} word${words.length - game.found.size === 1 ? '' : 's'} left.`;
    if (game.found.size === words.length) finish();
  };

  const finish = async () => {
    if (game.done) return;
    game.done = true;
    clearStart();
    clearHint();
    const perfect = game.misses === 0 && game.hints === 0;
    await recordWin(page, 'trail', level, {
      plays: (Number(page.leisure.trail?.plays) || 0) + 1,
      wins: (Number(page.leisure.trail?.wins) || 0) + 1,
      bestMisses:
        page.leisure.trail?.bestMisses == null
          ? game.misses
          : Math.min(Number(page.leisure.trail.bestMisses), game.misses),
      perfect: (Number(page.leisure.trail?.perfect) || 0) + (perfect ? 1 : 0),
    });
    const detail = perfect
      ? 'Every word found without a miss or a nudge.'
      : `${words.length} words found · ${game.misses} gentle miss${game.misses === 1 ? '' : 'es'}${game.hints ? ` · ${game.hints} nudge${game.hints === 1 ? '' : 's'}` : ''}.`;
    renderResult(page, 'trail', {
      level,
      iconName: 'search',
      title: 'The trail is clear.',
      detail,
      locked: level >= FREE_LEVELS && !isPremium(page.leisure),
    });
    status.textContent = 'Every word is settled. The letters can rest.';
    focusResult(page);
  };

  board.addEventListener('click', (event) => {
    const button = event.target.closest('[data-cell]');
    if (!button || game.done) return;
    const index = Number(button.dataset.cell);

    if (game.start == null) {
      game.start = index;
      button.classList.add('is-start');
      status.textContent = `Starting at row ${Math.floor(index / size) + 1}, column ${(index % size) + 1}. Tap the last letter of the word.`;
      return;
    }

    if (game.start === index) {
      clearStart();
      status.textContent = 'Start again from any letter.';
      return;
    }

    const line = lineBetween(game.start, index);
    if (!line) {
      clearStart();
      game.start = index;
      button.classList.add('is-start');
      status.textContent = 'Lines run straight. Starting again from this letter.';
      return;
    }

    const reversed = line.text.split('').reverse().join('');
    const word = words.find(
      (candidate) =>
        !game.found.has(candidate) && (candidate === line.text || candidate === reversed)
    );

    clearStart();

    if (word) {
      markFound(word, line.cells);
      return;
    }

    game.misses += 1;
    missesEl.textContent = game.misses;
    status.textContent = TRAIL_MISS_LINES[(game.misses - 1) % TRAIL_MISS_LINES.length];
    line.cells.forEach((cell) => {
      const el = buttonAt(cell);
      if (!el) return;
      el.classList.add('is-miss');
      later(page, () => el.classList.remove('is-miss'), 520);
    });
  });

  stage.querySelector('[data-trail-hint]')?.addEventListener('click', () => {
    if (game.done) return;
    const remaining = words.filter((word) => !game.found.has(word));
    if (!remaining.length) return;
    const word = remaining[Math.floor(Math.random() * remaining.length)];
    const placement = puzzle.placements.find((item) => item.word === word);
    if (!placement) return;
    game.hints += 1;
    clearHint();
    const first = placement.cells[0];
    const last = placement.cells[placement.cells.length - 1];
    buttonAt(first)?.classList.add('is-hinted');
    buttonAt(last)?.classList.add('is-hinted');
    status.textContent = `One still hidden: “${word}”. Its first letter sits at row ${Math.floor(first / size) + 1}, column ${(first % size) + 1}.`;
    game.hintTimer = later(page, clearHint, 3000);
  });

  stage.querySelector('[data-reset]')?.addEventListener('click', () => page.start('trail', level));
}

/* ------------------------------ One of these ----------------------------- */

function mountOdd(page) {
  clearTimers(page);
  const stage = page.root.querySelector('[data-stage]');
  if (!stage) return;
  page.activeId = 'odd';

  const level = page.level;
  const rounds = pickOddRounds(level);
  const game = {
    rounds,
    index: 0,
    misses: 0,
    done: false,
    locked: false,
    saved: false,
  };

  stage.innerHTML = `
    <div class="leisure-stage__bar">
      <div class="leisure-counters">
        <span class="leisure-counter"><strong data-odd-step>1</strong><small>of ${rounds.length}</small></span>
        <span class="leisure-counter"><strong data-odd-misses>0</strong><small>gentle misses</small></span>
      </div>
      <button class="btn btn--ghost btn--sm" type="button" data-reset>${icon('refresh', 14)} New set</button>
    </div>
    <p class="leisure-status" data-status role="status" aria-live="polite">Level ${level} · four small questions. Read each prompt, then choose.</p>
    <div class="round-stage" data-odd-stage data-round="0">
      <p class="odd-prompt" data-odd-prompt></p>
      <div class="odd-grid" data-odd-grid role="group" aria-label="Four choices"></div>
    </div>
    <div class="leisure-result-slot" data-result></div>
  `;

  const roundStage = stage.querySelector('[data-odd-stage]');
  const promptEl = stage.querySelector('[data-odd-prompt]');
  const grid = stage.querySelector('[data-odd-grid]');
  const status = stage.querySelector('[data-status]');
  const stepEl = stage.querySelector('[data-odd-step]');
  const missesEl = stage.querySelector('[data-odd-misses]');

  const renderRound = () => {
    const round = rounds[game.index];
    if (!round) return;
    roundStage.dataset.round = String(game.index);
    stepEl.textContent = game.index + 1;
    promptEl.textContent = round.prompt;
    grid.innerHTML = round.items
      .map(
        (label, index) => `<button class="odd-choice" type="button" data-odd="${index}">
          <span>${label}</span>
        </button>`
      )
      .join('');
    game.locked = false;
    status.textContent = 'Choose the one that does not fit.';
  };

  const finish = async () => {
    if (game.done) return;
    game.done = true;
    const perfect = game.misses === 0;
    await recordWin(page, 'odd', level, {
      plays: (Number(page.leisure.odd?.plays) || 0) + 1,
      wins: (Number(page.leisure.odd?.wins) || 0) + 1,
      bestMisses:
        page.leisure.odd?.bestMisses == null
          ? game.misses
          : Math.min(Number(page.leisure.odd.bestMisses), game.misses),
      perfect: (Number(page.leisure.odd?.perfect) || 0) + (perfect ? 1 : 0),
    });
    const detail = perfect
      ? 'Every difference noticed on the first look.'
      : `${game.misses} gentle miss${game.misses === 1 ? '' : 'es'} · all ${rounds.length} rounds settled.`;
    renderResult(page, 'odd', {
      level,
      iconName: 'eye',
      title: 'Every odd one, found.',
      detail,
      locked: level >= FREE_LEVELS && !isPremium(page.leisure),
    });
    status.textContent = 'All four choices are settled.';
    focusResult(page);
  };

  grid.addEventListener('click', (event) => {
    const button = event.target.closest('[data-odd]');
    if (!button || game.done || game.locked) return;
    const round = rounds[game.index];
    const label = round.items[Number(button.dataset.odd)];
    if (label === round.odd) {
      game.locked = true;
      button.classList.add('is-correct');
      button.setAttribute('aria-pressed', 'true');
      grid.querySelectorAll('button').forEach((choice) => {
        choice.disabled = true;
      });
      game.index += 1;
      if (game.index >= rounds.length) {
        finish();
      } else {
        status.textContent = `Yes — ${label} is the odd one. Next question.`;
        later(page, renderRound, 620);
      }
    } else {
      button.classList.add('is-miss');
      button.disabled = true;
      game.misses += 1;
      missesEl.textContent = game.misses;
      status.textContent = MISS_LINES[(game.misses - 1) % MISS_LINES.length];
    }
  });

  stage.querySelector('[data-reset]')?.addEventListener('click', () => page.start('odd', level));
  renderRound();
}

/* ------------------------------ Next in line ----------------------------- */

const PATTERN_DOTS = {
  1: [[32, 32]],
  2: [[24, 32], [40, 32]],
  3: [[22, 34], [32, 22], [42, 34]],
  4: [[23, 23], [41, 23], [23, 41], [41, 41]],
  5: [[20, 20], [44, 20], [32, 32], [20, 44], [44, 44]],
  6: [[22, 20], [42, 20], [22, 32], [42, 32], [22, 44], [42, 44]],
};

function patternGlyph(spec, px = 56) {
  const count = Number(spec.count) || 1;
  let body;
  if (count > 1) {
    body = (PATTERN_DOTS[Math.min(count, 6)] || PATTERN_DOTS[1])
      .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5.2" fill="currentColor"/>`)
      .join('');
  } else if (spec.shape === 'ring') {
    body = '<circle cx="32" cy="32" r="12" fill="none" stroke="currentColor" stroke-width="3.4"/>';
  } else if (spec.shape === 'triangle') {
    body = '<path d="M32 16 48 46H16Z" fill="currentColor"/>';
  } else if (spec.shape === 'diamond') {
    body = '<path d="M32 15 49 32 32 49 15 32Z" fill="currentColor"/>';
  } else if (spec.shape === 'square') {
    body = '<rect x="19" y="19" width="26" height="26" rx="4" fill="currentColor"/>';
  } else if (spec.shape === 'bar') {
    body = '<rect x="29" y="12" width="6" height="40" rx="3" fill="currentColor"/>';
  } else if (spec.shape === 'wand') {
    body =
      '<path d="M32 46V20" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>' +
      '<circle cx="32" cy="16" r="5" fill="currentColor"/>';
  } else {
    body = '<circle cx="32" cy="32" r="13" fill="currentColor"/>';
  }
  const rotate = Number(spec.rotate) || 0;
  const scale = Number(spec.scale) || 1;
  return `<svg class="pattern-glyph" viewBox="0 0 64 64" width="${px}" height="${px}"
    style="color:var(--${spec.tone})" aria-hidden="true">
    <g transform="translate(32 32) rotate(${rotate}) scale(${scale}) translate(-32 -32)">${body}</g>
  </svg>`;
}

function mountPattern(page) {
  clearTimers(page);
  const stage = page.root.querySelector('[data-stage]');
  if (!stage) return;
  page.activeId = 'pattern';

  const level = page.level;
  const rounds = buildPatternBoard(level);
  const game = {
    rounds,
    index: 0,
    misses: 0,
    done: false,
    locked: false,
    saved: false,
  };

  stage.innerHTML = `
    <div class="leisure-stage__bar">
      <div class="leisure-counters">
        <span class="leisure-counter"><strong data-pattern-step>1</strong><small>of ${rounds.length}</small></span>
        <span class="leisure-counter"><strong data-pattern-misses>0</strong><small>gentle misses</small></span>
      </div>
      <button class="btn btn--ghost btn--sm" type="button" data-reset>${icon('refresh', 14)} New sequence</button>
    </div>
    <p class="leisure-status" data-status role="status" aria-live="polite">Level ${level} · a short run of shapes. What comes next?</p>
    <div class="round-stage" data-pattern-stage data-round="0">
      <div class="pattern-sequence" data-pattern-sequence role="img" aria-label="The sequence so far"></div>
      <div class="pattern-options" data-pattern-options role="group" aria-label="Choose what comes next"></div>
    </div>
    <div class="leisure-result-slot" data-result></div>
  `;

  const roundStage = stage.querySelector('[data-pattern-stage]');
  const sequenceEl = stage.querySelector('[data-pattern-sequence]');
  const optionsEl = stage.querySelector('[data-pattern-options]');
  const status = stage.querySelector('[data-status]');
  const stepEl = stage.querySelector('[data-pattern-step]');
  const missesEl = stage.querySelector('[data-pattern-misses]');

  const renderRound = () => {
    const round = rounds[game.index];
    if (!round) return;
    roundStage.dataset.round = String(game.index);
    stepEl.textContent = game.index + 1;
    sequenceEl.setAttribute(
      'aria-label',
      `Sequence: ${round.sequence.map(patternLabel).join(', ')}. What comes next?`
    );
    sequenceEl.innerHTML =
      round.sequence
        .map(
          (spec) =>
            `<span class="pattern-tile">${patternGlyph(spec, 52)}</span>`
        )
        .join('') +
      `<span class="pattern-tile pattern-tile--ask" aria-hidden="true">?</span>`;
    optionsEl.innerHTML = round.options
      .map(
        (spec, index) =>
          `<button class="pattern-choice" type="button" data-pattern-choice="${index}"
            aria-label="Option ${index + 1}: ${patternLabel(spec)}">${patternGlyph(spec, 50)}</button>`
      )
      .join('');
    game.locked = false;
  };

  const finish = async () => {
    if (game.done) return;
    game.done = true;
    const perfect = game.misses === 0;
    await recordWin(page, 'pattern', level, {
      plays: (Number(page.leisure.pattern?.plays) || 0) + 1,
      wins: (Number(page.leisure.pattern?.wins) || 0) + 1,
      bestMisses:
        page.leisure.pattern?.bestMisses == null
          ? game.misses
          : Math.min(Number(page.leisure.pattern.bestMisses), game.misses),
      perfect: (Number(page.leisure.pattern?.perfect) || 0) + (perfect ? 1 : 0),
    });
    const detail = perfect
      ? 'Every sequence read on the first look.'
      : `${game.misses} gentle miss${game.misses === 1 ? '' : 'es'} · all ${rounds.length} sequences read.`;
    renderResult(page, 'pattern', {
      level,
      iconName: 'wand',
      title: 'The thread continues.',
      detail,
      locked: level >= FREE_LEVELS && !isPremium(page.leisure),
    });
    status.textContent = 'Every sequence is settled.';
    focusResult(page);
  };

  optionsEl.addEventListener('click', (event) => {
    const button = event.target.closest('[data-pattern-choice]');
    if (!button || game.done || game.locked) return;
    const round = rounds[game.index];
    if (Number(button.dataset.patternChoice) === round.answerIndex) {
      game.locked = true;
      button.classList.add('is-correct');
      optionsEl.querySelectorAll('button').forEach((choice) => {
        choice.disabled = true;
      });
      game.index += 1;
      if (game.index >= rounds.length) {
        finish();
      } else {
        status.textContent = 'That continues the run. Next one.';
        later(page, renderRound, 580);
      }
    } else {
      button.classList.add('is-miss');
      button.disabled = true;
      game.misses += 1;
      missesEl.textContent = game.misses;
      status.textContent = 'Not this one. The rhythm is still there — try another tile.';
    }
  });

  stage.querySelector('[data-reset]')?.addEventListener('click', () => page.start('pattern', level));
  renderRound();
}

/* --------------------------------- Page ---------------------------------- */

function renderHub(page, ctx) {
  page.root.innerHTML = hubMarkup(page.leisure);
  page.root.querySelector('[data-hub-unlock]')?.addEventListener('click', () => {
    openPremium(page, () => renderHub(page, ctx));
  });
}

export default async function render(root, ctx) {
  let leisure;
  try {
    leisure = await getLeisureState();
  } catch {
    leisure = {
      pairs: {},
      lantern: {},
      words: {},
      trail: {},
      odd: {},
      pattern: {},
      premium: { unlocked: false },
    };
  }

  const requested = ctx.query?.get('game');
  const active = GAME_IDS.includes(requested) ? requested : null;
  const page = { root, leisure, timers: new Set(), level: 1, activeId: active };

  page.start = (id, level) => {
    clearTimers(page);
    page.activeId = id;
    const clamped = clampLevel(level);
    page.level = isPremium(page.leisure) ? clamped : Math.min(clamped, FREE_LEVELS);
    paintLevelStrip(page, id);
    if (id === 'pairs') mountPairs(page);
    else if (id === 'lantern') mountLantern(page);
    else if (id === 'words') mountWords(page);
    else if (id === 'trail') mountTrail(page);
    else if (id === 'odd') mountOdd(page);
    else if (id === 'pattern') mountPattern(page);
  };

  if (!active) {
    renderHub(page, ctx);
  } else {
    root.innerHTML = stageShell(active, leisure);
    page.start(active, playableLevel(leisure, active));
  }

  return {
    destroy() {
      clearTimers(page);
    },
  };
}
