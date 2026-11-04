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

for (const [label, viewport] of sizes) {
  for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport, colorScheme: theme });
    const page = await context.newPage();
    page.on('console', (msg) => {
      if (msg.type() === 'error') problems.push(`[${label}/${theme}] console: ${msg.text()}`);
    });
    page.on('pageerror', (err) => problems.push(`[${label}/${theme}] pageerror: ${err.message}`));
    await page.addInitScript((t) => localStorage.setItem('pla.theme', t), theme);
    await page.goto(`${base}#/dashboard`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${out}/phase1-dashboard-${label}-${theme}.png`, fullPage: true });

    if (label === 'phone' && theme === 'light') {
      await page.goto(`${base}#/welcome`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${out}/phase1-welcome-phone.png`, fullPage: true });
      await page.goto(`${base}#/tasks`, { waitUntil: 'networkidle' });
      await page.click('[data-tab="more"]');
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${out}/phase1-more-phone.png` });
    }
    await context.close();
  }
}

await browser.close();
fs.writeFileSync(`${out}/problems.txt`, problems.join('\n') || 'no console errors');
console.log(problems.length ? problems.join('\n') : 'CLEAN: no console errors');
