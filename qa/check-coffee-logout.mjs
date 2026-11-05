import { chromium } from 'playwright';
import path from 'node:path';

const BASE = 'http://127.0.0.1:4173/';
const OUT = path.resolve('shots');
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  colorScheme: 'light',
  serviceWorkers: 'block',
});
const page = await context.newPage();
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console: ${m.text()}`);
});
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

await page.goto(`${BASE}#/welcome`, { waitUntil: 'networkidle' });
await page.locator('[data-demo]').click();
await page.waitForTimeout(900);
await page.goto(`${BASE}#/settings`, { waitUntil: 'networkidle' });
await page.waitForTimeout(700);

const forms = await page.locator('[data-puffy-form-choice], [data-pip-form-choice]').evaluateAll((els) =>
  els.map((e) => e.textContent.trim())
);
const colours = await page.locator('[data-mascot-choice]').evaluateAll((els) =>
  els.map((e) => e.textContent.trim())
);
console.log('forms:', forms.join(' · '));
console.log('colours:', colours.join(' · '));
console.log('defaults:', await page.evaluate(() => ({
  form: document.documentElement.dataset.pipForm,
  style: document.documentElement.dataset.mascot,
})));

await page.locator('[data-puffy-form-choice="coffee"], [data-pip-form-choice="coffee"]').click();
await page.locator('[data-mascot-choice="slate"]').click();
await page.waitForTimeout(600);
console.log('after picks:', await page.evaluate(() => ({
  form: document.documentElement.dataset.pipForm,
  style: document.documentElement.dataset.mascot,
  stored: document.querySelector('[data-mascot-note]')?.textContent,
})));

const studio = page.locator('.puffy-studio, .pip-studio');
await studio.scrollIntoViewIfNeeded();
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(OUT, 'round3-settings-desktop.png'), fullPage: true });
await studio.screenshot({ path: path.join(OUT, 'round3-pip-studio-desktop.png') });

await page.locator('[data-mascot-choice="ochre"]').click();
await page.waitForTimeout(500);
await studio.screenshot({ path: path.join(OUT, 'round3-pip-studio-ochre.png') });
await page.locator('[data-mascot-choice="slate"]').click();
await page.waitForTimeout(400);

await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(500);
await studio.scrollIntoViewIfNeeded();
await page.screenshot({ path: path.join(OUT, 'round3-settings-phone.png'), fullPage: true });

// Log out from the desktop sidebar.
await page.setViewportSize({ width: 1280, height: 900 });
await page.waitForTimeout(400);
await page.locator('[data-logout]').click();
await page.waitForTimeout(300);
const sheetTitle = await page.locator('.sheet h2').textContent();
await page.screenshot({ path: path.join(OUT, 'round3-logout-confirm.png') });
await page.locator('.sheet [data-ok]').click();
await page.waitForTimeout(700);
console.log('after logout:', await page.evaluate(() => ({
  hash: location.hash,
  welcome: Boolean(document.querySelector('.welcome')),
  chrome: document.documentElement.dataset.chrome,
  profileSaved: Boolean(document.querySelector('[data-return]')),
})));
await page.screenshot({ path: path.join(OUT, 'round3-welcome-after-logout.png'), fullPage: true });

// Direct app route while signed out should bounce back to welcome.
await page.goto(`${BASE}#/dashboard`, { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
console.log('guard:', await page.evaluate(() => ({
  hash: location.hash,
  welcome: Boolean(document.querySelector('.welcome')),
})));

// Sign back in through the returning tab.
await page.locator('[data-auth-tab="returning"]').click();
await page.locator('[data-return]').click();
await page.waitForTimeout(900);
console.log('sign in:', await page.evaluate(() => ({
  hash: location.hash,
  dashboard: document.documentElement.dataset.route === 'dashboard',
})));
await page.screenshot({ path: path.join(OUT, 'round3-dashboard-desktop.png'), fullPage: true });

// Log out from the phone More sheet.
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(400);
await page.locator('[data-tab="more"]').click();
await page.waitForTimeout(300);
const moreHasLogout = await page.locator('[data-logout-more]').count();
await page.locator('[data-logout-more]').click();
await page.waitForTimeout(300);
console.log('mobile more logout button:', moreHasLogout);
await page.locator('.sheet [data-ok]').click();
await page.waitForTimeout(700);
console.log('phone logout:', await page.evaluate(() => ({
  hash: location.hash,
  welcome: Boolean(document.querySelector('.welcome')),
})));
console.log('sheet title:', sheetTitle);
console.log('errors:', errors.length ? errors : 'none');

await browser.close();
