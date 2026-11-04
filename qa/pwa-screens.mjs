import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const OUT = path.resolve('../pla-frontend/assets/screenshots');
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();

for (const target of [
  { file: 'dashboard-desktop.png', viewport: { width: 1280, height: 800 } },
  { file: 'dashboard-phone.png', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
]) {
  const context = await browser.newContext({
    viewport: target.viewport,
    colorScheme: 'light',
    deviceScaleFactor: 1,
    isMobile: Boolean(target.isMobile),
    hasTouch: Boolean(target.hasTouch),
  });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4173/#/welcome', { waitUntil: 'networkidle' });
  await page.locator('[data-demo]').click();
  await page.waitForTimeout(600);
  await page.goto('http://127.0.0.1:4173/#/dashboard', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3800);
  await page.screenshot({ path: path.join(OUT, target.file) });
  await context.close();
  console.log('wrote', target.file);
}

await browser.close();
