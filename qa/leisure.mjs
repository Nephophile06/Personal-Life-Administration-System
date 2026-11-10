/**
 * Leisure QA — six games, level progression, Puffy Plus gate/unlock, persistence, offline.
 * Layout breadth lives in leisure-layout.mjs and leisure-advanced.mjs.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ODD_ROUNDS, WORD_BOARDS } from '../pla-frontend/assets/js/leisure-data.js';

const base = 'http://127.0.0.1:4173/';
const out = fileURLToPath(new URL('./shots', import.meta.url));
fs.mkdirSync(out, { recursive: true });

const issues = [];
const rows = [];
const fail = (msg) => {
  issues.push(msg);
  console.log('FAIL:', msg);
};
const note = (screen, detail, overflow = 0) => rows.push({ screen, detail, overflow });

const viewport = { width: 1280, height: 900 };
const browser = await chromium.launch({ channel: 'chromium' });

function watch(page) {
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}

async function seatDemo(page) {
  await page.goto(`${base}#/welcome`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.locator('[data-demo]').click();
  await page.waitForTimeout(3700);
}

const leisureState = (page) =>
  page.evaluate(async () => (await import('/assets/js/api.js')).getLeisureState());

async function strip(page) {
  return (await page.locator('[data-levelstrip]').textContent()).replace(/\s+/g, ' ').trim();
}

async function overflow(page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
}

async function openGame(page, id) {
  await page.goto(`${base}#/leisure?game=${id}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(450);
}

/* ------------------------------ Play helpers ----------------------------- */

async function playPairs(page) {
  const labels = await page.$$eval('.pair-card', (els) =>
    els.map((el) => el.querySelector('.pair-card__front span')?.textContent.trim())
  );
  const byLabel = new Map();
  labels.forEach((label, index) => {
    if (!byLabel.has(label)) byLabel.set(label, []);
    byLabel.get(label).push(index);
  });
  for (const indices of byLabel.values()) {
    for (const index of indices) await page.locator(`[data-pair="${index}"]`).click();
    await page.waitForTimeout(620);
  }
  await page.waitForSelector('.leisure-result');
  await page.waitForTimeout(250);
  return labels.length;
}

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

function lanternSolution(mask, size) {
  const full = (1 << (size * size)) - 1;
  if (mask === full) return [];
  const masks = lanternMasks(size);
  const total = 1 << (size * size);
  const prev = new Int32Array(total).fill(-1);
  const via = new Uint8Array(total);
  const queue = [mask];
  prev[mask] = mask;
  let head = 0;
  while (head < queue.length) {
    const current = queue[head];
    head += 1;
    for (let i = 0; i < masks.length; i += 1) {
      const next = current ^ masks[i];
      if (prev[next] !== -1) continue;
      prev[next] = current;
      via[next] = i;
      if (next === full) {
        const taps = [];
        let walk = full;
        while (walk !== mask) {
          taps.push(via[walk]);
          walk = prev[walk];
        }
        return taps.reverse();
      }
      queue.push(next);
    }
  }
  return null;
}

async function boardMask(page) {
  const lit = await page.$$eval('[data-lantern]', (els) =>
    els.map((el) => el.getAttribute('aria-pressed') === 'true')
  );
  return lit.reduce((mask, isLit, index) => (isLit ? mask | (1 << index) : mask), 0);
}

async function playLantern(page, size) {
  await page.locator('[data-hint]').click();
  const hinted = await page.locator('.lantern.is-hinted').count();
  const taps = lanternSolution(await boardMask(page), size);
  if (!taps) throw new Error('lantern puzzle is unsolvable');
  for (const index of taps) {
    await page.locator(`[data-lantern="${index}"]`).click();
    await page.waitForTimeout(70);
  }
  await page.waitForSelector('.leisure-result');
  await page.waitForTimeout(250);
  return { hinted, taps: taps.length };
}

async function playWords(page) {
  const words = await page.$$eval('.word-tile', (els) => els.map((el) => el.textContent.trim()));
  const board = WORD_BOARDS.find((candidate) => {
    const set = new Set(candidate.groups.flatMap((group) => group.words));
    return words.length === set.size && words.every((word) => set.has(word));
  });
  if (!board) throw new Error(`No matching word board for: ${words.join(', ')}`);

  await page.locator('[data-word-hint]').click();
  await page.waitForTimeout(180);
  const hintedRows = await page.locator('.word-found__row').count();
  if (hintedRows !== 1) fail(`words hint revealed ${hintedRows} rows instead of 1`);

  const revealed = await page.locator('.word-found__name').allTextContents();
  const remaining = board.groups.filter((group) => !revealed.includes(group.name));
  for (const [index, group] of remaining.entries()) {
    for (const word of group.words) {
      const tile = page.locator(`[data-word="${word}"]`);
      if (index === 0) {
        await tile.focus();
        await page.keyboard.press('Enter');
      } else {
        await tile.click();
      }
    }
    await page.locator('[data-word-check]').click();
    await page.waitForTimeout(200);
  }
  await page.waitForSelector('.leisure-result');
  await page.waitForTimeout(250);
  return { hintedRows, boardId: board.id };
}

async function playTrail(page) {
  const size = Number(await page.locator('[data-trail-board]').getAttribute('data-size'));
  const letters = await page.$$eval('.trail-cell', (els) =>
    els.map((el) => el.dataset.letter)
  );
  const words = await page.$$eval('.trail-word', (els) =>
    els.map((el) => el.dataset.trailWord)
  );
  const directions = [
    [0, 1], [1, 0], [1, 1], [1, -1], [0, -1], [-1, 0], [-1, -1], [-1, 1],
  ];
  const placements = [];
  for (const word of words) {
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
            placements.push({ word, cells });
            break outer;
          }
        }
      }
    }
  }
  if (placements.length !== words.length) {
    throw new Error(`trail: found ${placements.length}/${words.length} placements`);
  }
  for (const placement of placements) {
    await page.locator(`[data-cell="${placement.cells[0]}"]`).click();
    await page.locator(`[data-cell="${placement.cells[placement.cells.length - 1]}"]`).click();
    await page.waitForTimeout(140);
  }
  await page.waitForSelector('.leisure-result');
  await page.waitForTimeout(250);
  return { size, words: words.length };
}

async function playOdd(page) {
  let roundsPlayed = 0;
  let missClicks = 0;
  while (!(await page.locator('.leisure-result').count())) {
    const round = Number(await page.locator('[data-odd-stage]').getAttribute('data-round'));
    const prompt = (await page.locator('[data-odd-prompt]').innerText()).trim();
    const data = ODD_ROUNDS.find((candidate) => candidate.prompt === prompt);
    if (!data) throw new Error(`odd: no data for "${prompt}"`);
    const answer = await page.$$eval('.odd-choice', (choices, odd) =>
      choices.findIndex((choice) => choice.textContent.trim() === odd), data.odd
    );
    if (answer < 0) throw new Error(`odd: "${data.odd}" is not among the choices`);
    await page.locator(`[data-odd="${answer}"]`).click();
    await page.waitForFunction(
      (previous) =>
        document.querySelector('.leisure-result') ||
        Number(document.querySelector('[data-odd-stage]')?.dataset.round) !== previous,
      round,
      { timeout: 3000 }
    );
    roundsPlayed += 1;
    if (roundsPlayed > 8) break;
  }
  await page.waitForTimeout(250);
  return { roundsPlayed, missClicks };
}

async function playPattern(page) {
  let roundsPlayed = 0;
  let misses = 0;
  while (!(await page.locator('.leisure-result').count())) {
    const round = Number(await page.locator('[data-pattern-stage]').getAttribute('data-round'));
    let advanced = false;
    for (let index = 0; index < 3; index += 1) {
      const choice = page.locator(`[data-pattern-choice="${index}"]`);
      if (await choice.isDisabled()) continue;
      await choice.click();
      await page.waitForTimeout(160);
      if (await page.locator('.pattern-choice.is-correct').count()) {
        advanced = true;
        await page.waitForTimeout(650);
        break;
      }
      misses += 1;
    }
    if (!advanced && !(await page.locator('.leisure-result').count())) {
      throw new Error(`pattern: no answer accepted in round ${round + 1}`);
    }
    roundsPlayed += 1;
    if (roundsPlayed > 8) break;
  }
  await page.waitForTimeout(250);
  return { roundsPlayed, misses };
}

/* ------------------------------- Main pass ------------------------------- */

const context = await browser.newContext({ viewport, colorScheme: 'light' });
const page = await context.newPage();
const errors = watch(page);
await seatDemo(page);

/* Hub */
await page.goto(`${base}#/leisure`, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
const hub = await page.evaluate(() => ({
  cards: document.querySelectorAll('.leisure-card').length,
  plus: Boolean(document.querySelector('.leisure-plus')),
  offline: document.querySelector('#main')?.innerText.includes('Works offline'),
  cta: [...document.querySelectorAll('.leisure-card__play')].map((el) =>
    el.textContent.trim()
  ),
  overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
}));
if (hub.cards !== 6) fail(`hub has ${hub.cards} game cards instead of 6`);
if (!hub.plus) fail('hub is missing the Puffy Plus banner');
if (!hub.offline) fail('hub is missing the offline note');
if (!hub.cta.every((text) => /Begin level 1/.test(text))) fail(`hub CTAs: ${hub.cta.join(' | ')}`);
if (hub.overflow > 1) fail(`hub overflow ${hub.overflow}px`);
note('hub', `${hub.cards} cards · ${hub.cta.join(' / ')}`, hub.overflow);
await page.screenshot({ path: path.join(out, 'leisure6-hub-desktop.png'), fullPage: true });

const games = [
  { id: 'pairs', title: /All pairs found/, start: '8 cards' },
  { id: 'lantern', title: /Every lantern is awake/, start: '9 lamps' },
  { id: 'words', title: /3 threads, found/, start: '9 words' },
  { id: 'trail', title: /The trail is clear/, start: '36 cells' },
  { id: 'odd', title: /Every odd one, found/, start: '4 rounds' },
  { id: 'pattern', title: /The thread continues/, start: '4 rounds' },
];

for (const game of games) {
  await openGame(page, game.id);
  const levelText = await strip(page);
  if (!/Level 1/.test(levelText)) fail(`${game.id} starts at "${levelText}"`);

  let observed;
  if (game.id === 'pairs') {
    observed = `${await page.locator('.pair-card').count()} cards`;
    if (observed !== game.start) fail(`${game.id} starts with ${observed}`);
    await playPairs(page);
  } else if (game.id === 'lantern') {
    const lamps = await page.locator('[data-lantern]').count();
    observed = `${lamps} lamps`;
    if (observed !== game.start) fail(`${game.id} starts with ${observed}`);
    const play = await playLantern(page, 3);
    if (play.hinted !== 1) fail('lantern hint ring missing');
    if (play.taps === 0) fail('lantern solved with no taps');
  } else if (game.id === 'words') {
    observed = `${await page.locator('.word-tile').count()} words`;
    if (observed !== game.start) fail(`${game.id} starts with ${observed}`);
    await playWords(page);
  } else if (game.id === 'trail') {
    observed = `${await page.locator('.trail-cell').count()} cells`;
    if (observed !== game.start) fail(`${game.id} starts with ${observed}`);
    await playTrail(page);
  } else if (game.id === 'odd') {
    await playOdd(page);
    observed = `${await page.locator('.odd-choice').count()} choices`;
    if (observed !== '4 choices') fail(`${game.id} starts with ${observed}`);
  } else {
    const tiles = await page.locator('.pattern-tile').count();
    observed = `${tiles - 1} sequence tiles`;
    if (observed !== '4 sequence tiles') fail(`${game.id} starts with ${observed}`);
    await playPattern(page);
  }

  const result = (await page.locator('.leisure-result h2').innerText()).trim();
  if (!game.title.test(result)) fail(`${game.id} result "${result}"`);
  if (await page.locator('.leisure-gate').count()) fail(`${game.id} shows a gate at free level 1`);
  const nextLabel = (await page.locator('[data-next]').innerText()).trim();
  if (!/Next level 2/.test(nextLabel)) fail(`${game.id} next action "${nextLabel}"`);
  const saved = await leisureState(page);
  if (saved[game.id].level !== 2 || saved[game.id].cleared !== 1) {
    fail(`${game.id} saved level=${saved[game.id].level} cleared=${saved[game.id].cleared}`);
  }
  const over = await overflow(page);
  if (over > 1) fail(`${game.id} result overflow ${over}px`);
  note(game.id, `${observed} · "${result}" · ${nextLabel}`, over);
  await page.screenshot({
    path: path.join(out, `leisure6-${game.id}-result-desktop.png`),
    fullPage: true,
  });

  await page.locator('[data-next]').click();
  await page.waitForTimeout(550);
  const second = await strip(page);
  if (!/Level 2/.test(second)) fail(`${game.id} did not reach level 2: "${second}"`);
  if (game.id === 'pairs' && (await page.locator('.pair-card').count()) !== 12) {
    fail('pairs level 2 did not grow to 12 cards');
  }
}

/* Hub reflects progression */
await page.goto(`${base}#/leisure`, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
const after = await page.$$eval('.leisure-card', (cards) =>
  cards.map((card) => card.innerText.replace(/\s+/g, ' ').trim())
);
if (!after.every((text) => /Level 2/.test(text) && /1 level cleared/.test(text))) {
  fail(`hub progression: ${after.join(' | ')}`);
}
note('hub-progress', after[0].slice(0, 90));
await page.screenshot({ path: path.join(out, 'leisure6-hub-progress-desktop.png'), fullPage: true });

await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(600);
const persisted = await page.$$eval('.leisure-card', (cards) =>
  cards.map((card) => card.innerText.replace(/\s+/g, ' ').trim())
);
if (!persisted.every((text) => /Level 2/.test(text))) fail('hub progression did not survive reload');
note('persist', 'six games at level 2 after reload');

/* A stored level 7 cannot be opened without the entitlement */
await page.evaluate(async () => {
  const api = await import('/assets/js/api.js');
  await api.saveLeisureState({ pairs: { level: 7, cleared: 6 } });
});
await openGame(page, 'pairs');
if (!/Level 6/.test(await strip(page))) fail('locked level 7 was not clamped to level 6');
if ((await page.locator('.pair-card').count()) !== 18) fail('clamped level 6 board is wrong');
note('clamp', 'stored level 7 opens at level 6 without Plus');

/* Puffy Plus gate + unlock (pairs as the probe) */
await page.evaluate(async () => {
  const api = await import('/assets/js/api.js');
  await api.saveLeisureState({ pairs: { level: 6, cleared: 5 } });
});
await openGame(page, 'pairs');
const gateStrip = await strip(page);
if (!/Level 6/.test(gateStrip)) fail(`gate probe starts at "${gateStrip}"`);
if ((await page.locator('.pair-card').count()) !== 18) fail('level 6 pairs should have 18 cards');
await playPairs(page);
if ((await page.locator('.leisure-gate').count()) !== 1) fail('level 6 result is missing the Plus gate');
if (await page.locator('[data-next]').count()) fail('gated result still offers a next level');
if ((await page.locator('.leisure-result [data-unlock]').count()) !== 1) {
  fail('gated result is missing its unlock action');
}
await page.locator('.leisure-result').scrollIntoViewIfNeeded();
await page.waitForTimeout(200);
await page.screenshot({ path: path.join(out, 'leisure6-gate-desktop.png') });
await page.locator('.leisure-result [data-unlock]').click();
await page.waitForTimeout(350);
const sheetTitle = (await page.locator('#sheet-title').innerText()).trim();
if (!/Thirty more quiet levels/.test(sheetTitle)) fail(`Plus sheet title "${sheetTitle}"`);
const sheetNote = (await page.locator('.plus-note').innerText()).trim();
if (!/No card|no card|demo/i.test(sheetNote)) fail(`Plus sheet note "${sheetNote}"`);
await page.locator('[data-plus-unlock]').click();
await page.waitForTimeout(900);
const opened = await leisureState(page);
if (!opened.premium.unlocked) fail('demo unlock did not persist the entitlement');
if ((await page.locator('.pair-card').count()) !== 20) fail('level 7 pairs did not open with 20 cards');
if (!/Level 7/.test(await strip(page))) fail('level 7 strip was not painted');
if (await page.locator('.leisure-result').count()) fail('level 7 did not clear the old result');
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(200);
await page.screenshot({ path: path.join(out, 'leisure6-level7-desktop.png') });
note('plus', 'gate at 6 → unlock → level 7 with 20 cards');

await page.goto(`${base}#/leisure`, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
if ((await page.locator('.leisure-plus.is-open').count()) !== 1) fail('hub Plus banner is not open');
const plusCards = await page.$$eval('.leisure-card__play', (els) =>
  els.map((el) => el.textContent.trim())
);
if (!plusCards.every((text) => /Continue level/.test(text))) {
  fail(`unlocked hub CTAs: ${plusCards.join(' | ')}`);
}

if (errors.length) fail(`desktop console: ${errors.join(' | ')}`);
await context.close();

/* Offline: games open and accept taps with no network */
const offlineContext = await browser.newContext({ viewport: { width: 360, height: 800 } });
const offlinePage = await offlineContext.newPage();
const offlineErrors = watch(offlinePage);
await offlinePage.goto(`${base}#/welcome`, { waitUntil: 'networkidle' });
await offlinePage.locator('[data-demo]').click();
await offlinePage.waitForTimeout(3700);
await offlinePage.evaluate(() => navigator.serviceWorker.ready);
await offlinePage.reload({ waitUntil: 'networkidle' });
await offlinePage.waitForTimeout(800);

await offlineContext.setOffline(true);
await offlinePage.goto(`${base}#/leisure?game=trail`, { waitUntil: 'networkidle' });
await offlinePage.waitForTimeout(900);
const offlineState = await offlinePage.evaluate(() => ({
  cells: document.querySelectorAll('.trail-cell').length,
  heading: document.querySelector('#main h1')?.textContent.trim(),
  chip: document.getElementById('offline-chip')?.classList.contains('is-visible'),
}));
if (offlineState.cells !== 36) fail(`offline trail rendered ${offlineState.cells} cells`);
if (!offlineState.chip) fail('offline chip is not visible inside a game');
await offlinePage.locator('[data-cell="0"]').click();
await offlinePage.waitForTimeout(200);
if ((await offlinePage.locator('.trail-cell.is-start').count()) !== 1) {
  fail('offline trail did not accept a tap');
}
note('offline', `${offlineState.heading} · 36 cells · tap accepted`);
await offlinePage.screenshot({ path: path.join(out, 'leisure6-offline-phone.png') });
if (offlineErrors.length) fail(`offline console: ${offlineErrors.join(' | ')}`);
await offlineContext.close();

await browser.close();

const summary = rows
  .map((row) => `${row.screen}: "${row.detail}" overflow=${row.overflow}`)
  .join('\n');
fs.writeFileSync(
  path.join(out, 'leisure-qa.txt'),
  `${summary}\n\n${
    issues.length
      ? `ISSUES:\n${issues.join('\n')}`
      : 'CLEAN: six games played, levels saved, Plus unlocked, offline trail accepted a tap.'
  }`
);

if (issues.length) {
  console.log(`\n${issues.length} issue(s):\n- ${issues.join('\n- ')}`);
  process.exit(1);
}
console.log(`\nCLEAN — ${rows.length} checks.`);
