/**
 * Leisure advanced-state sweep — Puffy Plus level 36 boards at phone and tablet.
 * Seeds a local premium entitlement, screenshots each game, and checks overflow.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const base = 'http://127.0.0.1:4173/';
const out = fileURLToPath(new URL('./shots', import.meta.url));
fs.mkdirSync(out, { recursive: true });

const sizes = [
  ['phone', { width: 360, height: 800 }],
  ['tablet', { width: 768, height: 1024 }],
];
const routes = [
  ['hub', '#/leisure'],
  ['pairs', '#/leisure?game=pairs'],
  ['lantern', '#/leisure?game=lantern'],
  ['words', '#/leisure?game=words'],
  ['trail', '#/leisure?game=trail'],
  ['odd', '#/leisure?game=odd'],
  ['pattern', '#/leisure?game=pattern'],
];

const browser = await chromium.launch({ channel: 'chromium' });
const issues = [];
let checks = 0;

for (const [label, viewport] of sizes) {
  for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport, colorScheme: theme });
    const page = await context.newPage();
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    await page.addInitScript((t) => localStorage.setItem('pla.theme', t), theme);
    await page.goto(`${base}#/welcome`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(450);
    await page.locator('[data-demo]').click();
    await page.waitForTimeout(550);

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

    for (const [name, hash] of routes) {
      await page.goto(`${base}${hash}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(450);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      if (overflow > 1) issues.push(`${label}/${theme}/${name} overflow ${overflow}px`);
      if (errors.length) {
        issues.push(`${label}/${theme}/${name} console: ${errors.join(' | ')}`);
        errors.length = 0;
      }
      checks += 1;
      await page.screenshot({
        path: path.join(out, `leisure-plus36-${name}-${label}-${theme}.png`),
        fullPage: true,
      });
    }

    if (errors.length) issues.push(`${label}/${theme} console: ${errors.join(' | ')}`);
    await context.close();
  }
}

/* The free-level gate itself on a phone, where its actions are tightest. */
{
  const context = await browser.newContext({
    viewport: { width: 360, height: 800 },
    colorScheme: 'light',
  });
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
    await api.saveLeisureState({ pairs: { level: 6, cleared: 5 } });
  });
  await page.goto(`${base}#/leisure?game=pairs`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
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
  await page.waitForSelector('.leisure-gate');
  await page.locator('.leisure-result').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  if (overflow > 1) issues.push(`phone gate overflow ${overflow}px`);
  if ((await page.locator('.leisure-result [data-unlock]').count()) !== 1) {
    issues.push('phone gate is missing its unlock action');
  }
  if (errors.length) issues.push(`phone gate console: ${errors.join(' | ')}`);
  checks += 1;
  await page.screenshot({ path: path.join(out, 'leisure6-gate-phone.png') });
  await context.close();
}

await browser.close();
console.log(`${checks} advanced layout checks`);
if (issues.length) {
  console.log(issues.join('\n'));
  process.exit(1);
}
console.log('CLEAN');
