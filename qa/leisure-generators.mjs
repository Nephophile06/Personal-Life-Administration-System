/**
 * Leisure generator QA — repeated boards at every level, plus level-36 DOM checks.
 * Verifies word sets, odd rounds, pattern options, trail placements and lantern solvability.
 */
import { chromium } from 'playwright';
import {
  MAX_LEVEL, buildPatternBoard, buildWordBoard, pairPlan, pickOddRounds, trailPlan, trailWords,
} from '../pla-frontend/assets/js/leisure-data.js';

const base = 'http://127.0.0.1:4173/';
const issues = [];
const fail = (msg) => {
  issues.push(msg);
  console.log('FAIL:', msg);
};

/* ------------------------- Pure generator checks ------------------------- */

const key = (spec) =>
  `${spec.shape}|${spec.tone}|${spec.count || 1}|${spec.rotate || 0}|${spec.scale || 1}`;

for (let level = 1; level <= MAX_LEVEL; level += 1) {
  const plan = pairPlan(level);
  if (plan.pairs < 4 || plan.pairs > 12) fail(`pairs level ${level}: ${plan.pairs} pairs`);

  const trail = trailPlan(level);
  const words = trailWords(level, trail.count, trail.size);
  if (words.length !== trail.count) {
    fail(`trail level ${level}: ${words.length}/${trail.count} words`);
  }
  if (new Set(words).size !== words.length) fail(`trail level ${level}: duplicate words`);
  words.forEach((word) => {
    if (word.length < 4 || word.length > trail.size) {
      fail(`trail level ${level}: "${word}" does not fit ${trail.size}`);
    }
  });

  for (let run = 0; run < 25; run += 1) {
    const odd = pickOddRounds(level);
    const wantedRounds = level <= 6 ? 4 : 5;
    if (odd.length !== wantedRounds) fail(`odd level ${level}: ${odd.length} rounds`);
    if (new Set(odd.map((round) => round.prompt)).size !== odd.length) {
      fail(`odd level ${level}: duplicate prompt`);
    }
    odd.forEach((round) => {
      if (!round.items.includes(round.odd)) fail(`odd level ${level}: answer missing`);
      if (round.items.length !== 4) fail(`odd level ${level}: ${round.items.length} choices`);
    });

    const wordsBoard = buildWordBoard(level);
    const wantedGroups = level <= 6 ? 3 : level <= 18 ? 4 : 5;
    if (wordsBoard.groups.length !== wantedGroups) {
      fail(`words level ${level}: ${wordsBoard.groups.length} groups`);
    }
    const seenWords = new Set();
    wordsBoard.groups.forEach((group) => {
      if (group.words.length !== 3) fail(`words level ${level}: group "${group.name}" has ${group.words.length}`);
      group.words.forEach((word) => {
        if (seenWords.has(word)) fail(`words level ${level}: duplicate "${word}"`);
        seenWords.add(word);
      });
    });

    const pattern = buildPatternBoard(level);
    const wantedPattern = level <= 6 ? 4 : 5;
    if (pattern.length !== wantedPattern) fail(`pattern level ${level}: ${pattern.length} rounds`);
    pattern.forEach((round, index) => {
      const wantedLength = level <= 6 ? 4 : 5;
      if (round.sequence.length !== wantedLength) {
        fail(`pattern level ${level} r${index + 1}: ${round.sequence.length} sequence tiles`);
      }
      if (round.options.length !== 3) fail(`pattern level ${level} r${index + 1}: ${round.options.length} options`);
      if (new Set(round.options.map(key)).size !== 3) {
        fail(`pattern level ${level} r${index + 1}: duplicate options`);
      }
      if (round.answerIndex < 0 || round.answerIndex > 2) {
        fail(`pattern level ${level} r${index + 1}: answerIndex ${round.answerIndex}`);
      }
      if (round.options[round.answerIndex] == null) {
        fail(`pattern level ${level} r${index + 1}: answer missing`);
      }
    });
  }
}

console.log('pure generators: levels 1–36 × 25 runs');

/* ------------------------------- DOM checks ------------------------------ */

function lanternSolvable(size, litMask) {
  const full = (1 << (size * size)) - 1;
  const masks = Array.from({ length: size * size }, (_, index) => {
    const row = Math.floor(index / size);
    const col = index % size;
    let mask = 1 << index;
    if (row > 0) mask |= 1 << (index - size);
    if (row < size - 1) mask |= 1 << (index + size);
    if (col > 0) mask |= 1 << (index - 1);
    if (col < size - 1) mask |= 1 << (index + 1);
    return mask;
  });
  const rows = masks.map((mask, cell) => ({
    mask,
    b: ((full ^ litMask) >> cell) & 1,
  }));
  let rank = 0;
  for (let col = 0; col < size * size; col += 1) {
    const pivot = rows.findIndex((row, index) => index >= rank && ((row.mask >> col) & 1));
    if (pivot < 0) continue;
    [rows[rank], rows[pivot]] = [rows[pivot], rows[rank]];
    for (let i = 0; i < rows.length; i += 1) {
      if (i !== rank && ((rows[i].mask >> col) & 1)) {
        rows[i].mask ^= rows[rank].mask;
        rows[i].b ^= rows[rank].b;
      }
    }
    rank += 1;
  }
  return rows.every((row) => row.mask !== 0 || row.b === 0);
}

function findTrail(size, letters, words) {
  const directions = [
    [0, 1], [1, 0], [1, 1], [1, -1], [0, -1], [-1, 0], [-1, -1], [-1, 1],
  ];
  const found = [];
  for (const word of words) {
    let placement = null;
    outer: for (let r = 0; r < size; r += 1) {
      for (let c = 0; c < size; c += 1) {
        for (const [dr, dc] of directions) {
          let text = '';
          const cells = [];
          for (let k = 0; k < word.length; k += 1) {
            const rr = r + dr * k;
            const cc = c + dc * k;
            if (rr < 0 || cc < 0 || rr >= size || cc >= size) break;
            cells.push(rr * size + cc);
            text += letters[rr * size + cc];
          }
          if (text === word) {
            placement = cells;
            break outer;
          }
        }
      }
    }
    if (placement) found.push({ word, placement });
  }
  return found;
}

const browser = await chromium.launch({ channel: 'chromium' });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

await page.goto(`${base}#/welcome`, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
await page.locator('[data-demo]').click();
await page.waitForTimeout(3700);
await page.evaluate(async () => {
  const api = await import('/assets/js/api.js');
  const level = 36;
  await api.saveLeisureState({
    premium: { unlocked: true, since: new Date().toISOString(), source: 'qa' },
    pairs: { level, cleared: 35 },
    lantern: { level, cleared: 35 },
    words: { level, cleared: 35 },
    trail: { level, cleared: 35 },
    odd: { level, cleared: 35 },
    pattern: { level, cleared: 35 },
  });
});

async function openRoute(id) {
  await page.goto(`${base}#/leisure?game=${id}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(450);
}

/* Pairs: twelve distinct labels, each twice */
await openRoute('pairs');
for (let run = 0; run < 8; run += 1) {
  const labels = await page.$$eval('.pair-card', (els) =>
    els.map((el) => el.querySelector('.pair-card__front span')?.textContent.trim())
  );
  if (labels.length !== 24) fail(`pairs level 36: ${labels.length} cards`);
  const counts = new Map();
  labels.forEach((label) => counts.set(label, (counts.get(label) || 0) + 1));
  if (counts.size !== 12 || [...counts.values()].some((count) => count !== 2)) {
    fail('pairs level 36: labels are not twelve pairs');
  }
  await page.locator('[data-reset]').click();
  await page.waitForTimeout(380);
}

/* Lantern: every 5×5 mask must be solvable */
await openRoute('lantern');
for (let run = 0; run < 20; run += 1) {
  const lit = await page.$$eval('[data-lantern]', (els) =>
    els.map((el) => el.getAttribute('aria-pressed') === 'true')
  );
  const mask = lit.reduce((value, on, index) => (on ? value | (1 << index) : value), 0);
  if (lit.length !== 25) fail(`lantern level 36: ${lit.length} lamps`);
  if (!lanternSolvable(5, mask)) fail('lantern level 36: unsolvable mask');
  await page.locator('[data-reset]').click();
  await page.waitForTimeout(380);
}

/* Words: fifteen distinct words across five groups */
await openRoute('words');
for (let run = 0; run < 8; run += 1) {
  const words = await page.$$eval('.word-tile', (els) => els.map((el) => el.textContent.trim()));
  if (words.length !== 15) fail(`words level 36: ${words.length} tiles`);
  if (new Set(words).size !== words.length) fail('words level 36: duplicate tiles');
  await page.locator('[data-reset]').click();
  await page.waitForTimeout(380);
}

/* Trail: every one of eight words must actually sit in the grid */
await openRoute('trail');
for (let run = 0; run < 12; run += 1) {
  const size = Number(await page.locator('[data-trail-board]').getAttribute('data-size'));
  const letters = await page.$$eval('.trail-cell', (els) => els.map((el) => el.dataset.letter));
  const words = await page.$$eval('.trail-word', (els) => els.map((el) => el.dataset.trailWord));
  if (size !== 9) fail(`trail level 36: grid ${size}`);
  if (words.length !== 8) fail(`trail level 36: ${words.length} words`);
  const found = findTrail(size, letters, words);
  if (found.length !== words.length) {
    fail(`trail level 36: ${found.length}/${words.length} words placed`);
  }
  await page.locator('[data-reset]').click();
  await page.waitForTimeout(380);
}

/* Odd + pattern: board shapes and accessible labels */
await openRoute('odd');
for (let run = 0; run < 6; run += 1) {
  const choices = await page.$$eval('.odd-choice', (els) =>
    els.map((el) => el.textContent.trim())
  );
  const prompt = (await page.locator('[data-odd-prompt]').innerText()).trim();
  if (choices.length !== 4) fail(`odd level 36: ${choices.length} choices`);
  if (!prompt.endsWith('?')) fail(`odd level 36: prompt "${prompt}"`);
  await page.locator('[data-reset]').click();
  await page.waitForTimeout(380);
}

await openRoute('pattern');
for (let run = 0; run < 8; run += 1) {
  const tiles = await page.locator('.pattern-tile').count();
  const options = await page.locator('.pattern-choice').count();
  const label = await page.locator('[data-pattern-sequence]').getAttribute('aria-label');
  if (tiles !== 6) fail(`pattern level 36: ${tiles} sequence tiles`);
  if (options !== 3) fail(`pattern level 36: ${options} options`);
  if (!label?.startsWith('Sequence:') || !label.includes('What comes next?')) {
    fail(`pattern level 36: aria-label "${label}"`);
  }
  await page.locator('[data-reset]').click();
  await page.waitForTimeout(380);
}

if (errors.length) fail(`console: ${errors.join(' | ')}`);
await context.close();
await browser.close();

if (issues.length) {
  console.log(`\n${issues.length} issue(s):\n- ${issues.join('\n- ')}`);
  process.exit(1);
}
console.log('DOM level 36: pairs 24 · lantern 25 · words 15 · trail 9×9/8 · odd 4 · pattern 5+?');
console.log('\nCLEAN — generators hold across every level and repeated boards.');
