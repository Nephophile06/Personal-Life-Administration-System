import { chromium } from 'playwright';
import fs from 'node:fs';

const base = 'http://127.0.0.1:4173/';
const out = './shots';
fs.mkdirSync(out, { recursive: true });

const sizes = [
  ['phone', { width: 360, height: 800 }],
  ['tablet', { width: 768, height: 1024 }],
  ['desktop', { width: 1280, height: 900 }],
];

const browser = await chromium.launch();
const problems = [];
const notes = [];

async function clearToasts(page) {
  await page.evaluate(() => document.querySelectorAll('.toast-region .toast').forEach((el) => el.remove()));
  await page.waitForTimeout(150);
}

async function newPage(viewport, theme) {
  const context = await browser.newContext({ viewport, colorScheme: theme });
  const page = await context.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error') problems.push(`[${viewport.width}/${theme}] console: ${msg.text()}`);
  });
  page.on('pageerror', (err) => problems.push(`[${viewport.width}/${theme}] pageerror: ${err.message}`));
  await page.addInitScript((t) => localStorage.setItem('pla.theme', t), theme);
  return { context, page };
}

for (const [label, viewport] of sizes) {
  for (const theme of ['light', 'dark']) {
    const { context, page } = await newPage(viewport, theme);
    await page.goto(`${base}#/welcome`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(450);
    await page.screenshot({ path: `${out}/phase4-welcome-${label}-${theme}.png`, fullPage: true });

    const welcome = await page.evaluate(() => ({
      heading: document.querySelector('.welcome__body h1')?.innerText.replace(/\n/g, ' '),
      tabs: [...document.querySelectorAll('[data-auth-tab]')].map((el) => el.textContent.trim()),
      panel: document.querySelector('[data-panel="new"]')?.hidden === false ? 'new' : 'returning',
    }));
    notes.push(`[${label}/${theme}] welcome: ${JSON.stringify(welcome)}`);

    if (label === 'tablet' && theme === 'light') {
      // Exercise the fake registration path.
      await page.fill('#signup-name', 'Maya Chen');
      await page.fill('#signup-email', 'maya.chen@example.com');
      await page.click('[data-signup-submit]');
    } else {
      await page.click('[data-demo]');
    }
    await page.waitForFunction(() => location.hash === '#/dashboard', null, { timeout: 8000 });
    await page.waitForSelector('.dashboard');
    await page.waitForTimeout(900);
    await clearToasts(page);
    await page.screenshot({ path: `${out}/phase4-dashboard-${label}-${theme}.png`, fullPage: true });

    const glance = await page.evaluate(() => ({
      hero: document.querySelector('.home-hero h1')?.innerText.replace(/\n/g, ' '),
      nudge: document.querySelector('[data-hero-nudge]')?.textContent,
      planBlocks: document.querySelectorAll('.timeline__item').length,
      bills: document.querySelectorAll('.bill-mini').length,
      habits: document.querySelectorAll('.habit-mini').length,
      goals: document.querySelectorAll('.goal-mini').length,
      budget: document.querySelector('.budget-figures .num')?.textContent,
      hash: location.hash,
      consoleTheme: document.documentElement.dataset.theme,
    }));
    notes.push(`[${label}/${theme}] dashboard: ${JSON.stringify(glance)}`);

    if (label === 'desktop' && theme === 'light') {
      await page.click('[data-dash-mood="2"]');
      await page.waitForTimeout(650);
      const mood = await page.evaluate(() => ({
        tag: document.querySelector('[data-mood-tag]')?.textContent,
        note: document.querySelector('[data-mood-note]')?.textContent,
        nudge: document.querySelector('[data-hero-nudge]')?.textContent,
        selected: document.querySelector('[data-dash-mood][aria-pressed="true"]')?.dataset.dashMood,
        planHasLowMoodCopy: document.querySelector('.timeline')?.textContent.includes('Kept light'),
      }));
      notes.push(`[desktop/light] after low mood: ${JSON.stringify(mood)}`);
      await clearToasts(page);
      await page.screenshot({ path: `${out}/phase4-dashboard-low-mood.png`, fullPage: true });

      const before = await page.locator('[data-habits-count]').textContent();
      await page.locator('[data-habit-toggle]').nth(2).click();
      await page.waitForTimeout(450);
      const after = await page.locator('[data-habits-count]').textContent();
      const pressed = await page.locator('[data-habit-toggle]').nth(2).getAttribute('aria-pressed');
      notes.push(`[desktop/light] habit count ${before} -> ${after}, pressed=${pressed}`);
      await clearToasts(page);
      await page.screenshot({ path: `${out}/phase4-dashboard-habit.png`, fullPage: true });
    }

    await context.close();
  }
}

await browser.close();
fs.writeFileSync(`${out}/phase4-notes.txt`, notes.join('\n'));
fs.writeFileSync(`${out}/phase4-problems.txt`, problems.join('\n') || 'no console errors');
console.log(notes.join('\n'));
console.log(problems.length ? `\nPROBLEMS:\n${problems.join('\n')}` : '\nCLEAN: no console errors');
