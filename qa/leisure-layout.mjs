/**
 * Leisure layout sweep — hub and all six games at 360/768/1280 in light/dark.
 * Saves screenshots and reports horizontal overflow.
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
  ['desktop', { width: 1280, height: 900 }],
];
const themes = ['light', 'dark'];
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
  for (const theme of themes) {
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

    for (const [name, hash] of routes) {
      await page.goto(`${base}${hash}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(400);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      if (overflow > 1) issues.push(`${label}/${theme}/${name} overflow ${overflow}px`);
      checks += 1;
      await page.screenshot({
        path: path.join(out, `leisure-v2-${name}-${label}-${theme}.png`),
        fullPage: true,
      });
    }

    if (errors.length) issues.push(`${label}/${theme} console: ${errors.join(' | ')}`);
    await context.close();
  }
}

await browser.close();
console.log(`${checks} layout checks`);
if (issues.length) {
  console.log(issues.join('\n'));
  process.exit(1);
}
console.log('CLEAN');
