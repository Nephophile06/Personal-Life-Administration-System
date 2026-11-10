/**
 * Phase 10 QA — every screen at phone/tablet/desktop, light/dark.
 * Checks console errors, horizontal overflow, key landmarks and screenshots.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const base = 'http://127.0.0.1:4173/';
const out = './shots';
fs.mkdirSync(out, { recursive: true });

const routes = [
  ['dashboard', 'Today'],
  ['tasks', 'Tasks'],
  ['planner', 'Daily planner'],
  ['bills', 'Bills'],
  ['money', 'Expenses & budgets'],
  ['habits', 'Habits & goals'],
  ['review', 'Weekly review'],
  ['leisure', 'Something gentle to do'],
  ['leisure?game=pairs', 'Quiet pairs'],
  ['leisure?game=lantern', 'Lantern grid'],
  ['leisure?game=words', 'Three by three'],
  ['leisure?game=trail', 'Letter trail'],
  ['leisure?game=odd', 'One of these'],
  ['leisure?game=pattern', 'Next in line'],
  ['notifications', 'Notifications'],
  ['settings', 'Settings'],
];

const sizes = [
  ['phone', { width: 360, height: 800 }],
  ['tablet', { width: 768, height: 1024 }],
  ['desktop', { width: 1280, height: 900 }],
];

const issues = [];
const rows = [];
const slug = (route) => route.replace(/[^\w-]+/g, '-').replace(/-+$/, '');
const fail = (msg) => {
  issues.push(msg);
  console.log('FAIL:', msg);
};

const browser = await chromium.launch({ channel: 'chromium' });

for (const [label, viewport] of sizes) {
  for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport, colorScheme: theme });
    const page = await context.newPage();
    const errors = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

    await page.addInitScript((t) => localStorage.setItem('pla.theme', t), theme);
    await page.goto(`${base}#/welcome`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    const welcome = await page.evaluate(() => ({
      text: document.querySelector('#main')?.innerText.length || 0,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      heading: document.querySelector('#main h1')?.textContent.trim(),
    }));
    if (welcome.overflow > 1) fail(`${label}/${theme}/welcome overflow ${welcome.overflow}px`);
    if (!welcome.text) fail(`${label}/${theme}/welcome rendered no text`);
    rows.push({ label, theme, route: 'welcome', heading: welcome.heading, overflow: welcome.overflow, focusables: null });
    if (theme === 'light') {
      await page.screenshot({ path: path.join(out, `phase10-welcome-${label}.png`), fullPage: false });
    }
    await page.locator('[data-demo]').click();
    await page.waitForTimeout(700);

    for (const [route, expected] of routes) {
      await page.goto(`${base}#/${route}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(900);
      const state = await page.evaluate(() => {
        const main = document.querySelector('#main');
        const text = main ? main.innerText : '';
        const h = main ? main.querySelector('h1, h2')?.textContent.trim() : '';
        const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
        const focusables = main ? main.querySelectorAll('a, button, input, select, textarea, [tabindex]').length : 0;
        const imagesWithoutAlt = [...document.querySelectorAll('img')].filter((i) => !i.hasAttribute('alt')).length;
        return { h, overflow, len: text.length, focusables, imagesWithoutAlt };
      });
      if (state.overflow > 1) fail(`${label}/${theme}/${route} overflow ${state.overflow}px`);
      if (!state.len) fail(`${label}/${theme}/${route} rendered no text`);
      if (state.imagesWithoutAlt) fail(`${label}/${theme}/${route} has ${state.imagesWithoutAlt} img without alt`);
      rows.push({ label, theme, route, heading: state.h, overflow: state.overflow, focusables: state.focusables });
      if (route === 'settings') {
        await page.screenshot({ path: path.join(out, `phase10-${slug(route)}-${label}-${theme}.png`) });
      }
    }

    if (errors.length) fail(`${label}/${theme} console errors: ${errors.join(' | ')}`);
    await context.close();
  }
}

/* Full-page design pass at desktop and phone, light only (captured above for settings). */
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'light' });
const page = await context.newPage();
await page.goto(`${base}#/welcome`, { waitUntil: 'networkidle' });
await page.locator('[data-demo]').click();
await page.waitForTimeout(600);
for (const [route] of routes) {
  await page.goto(`${base}#/${route}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(out, `phase10-${slug(route)}-desktop.png`), fullPage: true });
}
await context.close();

await browser.close();

const summary = rows
  .map(
    (r) =>
      `${r.label}/${r.theme} ${r.route}: h="${r.heading}" overflow=${r.overflow} focusables=${r.focusables}`
  )
  .join('\n');
fs.writeFileSync(
  path.join(out, 'phase10-layout.txt'),
  `${summary}\n\n${issues.length ? `ISSUES:\n${issues.join('\n')}` : 'CLEAN: all screens rendered without overflow or console errors.'}`
);

if (issues.length) {
  console.log(`\n${issues.length} issue(s):\n- ${issues.join('\n- ')}`);
  process.exit(1);
}
console.log(`\nCLEAN: ${rows.length} screen/theme combinations rendered without overflow or console errors.`);
