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
  await page.waitForTimeout(120);
}

async function newPage(viewport, theme) {
  const context = await browser.newContext({
    viewport,
    colorScheme: theme,
    acceptDownloads: true,
  });
  const page = await context.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error') problems.push(`[${viewport.width}/${theme}] console: ${msg.text()}`);
  });
  page.on('pageerror', (err) => problems.push(`[${viewport.width}/${theme}] pageerror: ${err.message}`));
  await page.addInitScript((t) => localStorage.setItem('pla.theme', t), theme);
  return { context, page };
}

async function seed(page) {
  await page.goto(`${base}#/welcome`, { waitUntil: 'networkidle' });
  await page.click('[data-demo]');
  await page.waitForFunction(() => location.hash === '#/dashboard', null, { timeout: 8000 });
  await page.waitForSelector('.dashboard');
}

async function openSettings(page) {
  await page.goto(`${base}#/settings`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.settings-page [data-accent-choice]');
  await page.waitForTimeout(450);
}

for (const [label, viewport] of sizes) {
  for (const theme of ['light', 'dark']) {
    const { context, page } = await newPage(viewport, theme);
    await seed(page);
    await openSettings(page);
    await clearToasts(page);
    await page.screenshot({ path: `${out}/phase8-settings-${label}-${theme}.png`, fullPage: true });
    if (label === 'phone' && theme === 'light') {
      await page.screenshot({ path: `${out}/phase8-settings-phone-viewport.png` });
    }

    const glance = await page.evaluate(() => {
      const labels = [...document.querySelectorAll('.accent-choice__label')];
      return {
        cards: document.querySelectorAll('.settings-card').length,
        accents: document.querySelectorAll('[data-accent-choice]').length,
        themes: document.querySelectorAll('[data-theme-choice]').length,
        mascots: document.querySelectorAll('[data-mascot-choice]').length,
        avatars: document.querySelectorAll('[data-avatar-style]').length,
        tiles: document.querySelectorAll('[data-export-quick]').length,
        rail: document.querySelectorAll('.settings-rail .rail-card').length,
        statsRows: document.querySelectorAll('.settings-stats li').length,
        ledger: [...document.querySelectorAll('.settings-ledger .ledger-cell__value')].map((v) =>
          v.textContent.replace(/\s+/g, ' ').trim()
        ),
        accentLabelsFit: labels.every((el) => el.scrollWidth <= el.clientWidth + 1),
        overflow: document.documentElement.scrollWidth - window.innerWidth,
      };
    });
    notes.push(`[${label}/${theme}] settings: ${JSON.stringify(glance)}`);
    if (glance.overflow > 0) problems.push(`[${label}/${theme}] horizontal overflow ${glance.overflow}px`);
    if (glance.accents !== 5) problems.push(`[${label}/${theme}] expected 5 accents`);
    if (!glance.accentLabelsFit) notes.push(`[${label}/${theme}] accent labels truncated`);

    await context.close();
  }
}

/* -------------------------------------------------------------------------
   Desktop / light interactions
   ------------------------------------------------------------------------- */
{
  const { context, page } = await newPage({ width: 1280, height: 900 }, 'light');
  await seed(page);
  await openSettings(page);
  await clearToasts(page);

  const getPrefs = () =>
    page.evaluate(() => ({
      accent: document.documentElement.dataset.accent,
      theme: document.documentElement.dataset.theme,
      themePref: localStorage.getItem('pla.theme'),
      mascot: document.documentElement.dataset.mascot,
      pipPod: getComputedStyle(document.documentElement).getPropertyValue('--pip-pod').trim(),
      avatarPip: document.querySelectorAll('.profile-chip .avatar--pip').length,
      name: document.querySelector('[data-profile-name]').textContent,
      ledgerName: document.querySelector('[data-summary-name]')?.textContent || '',
      avatarText: document.querySelector('.profile-chip .avatar')?.textContent.trim() || '',
    }));

  /* Accent */
  await page.click('[data-accent-choice="sage"]');
  await page.waitForTimeout(350);
  let prefs = await getPrefs();
  notes.push(
    `[desktop/light] accent: html=${prefs.accent}, stored=${await page.evaluate(() => localStorage.getItem('pla.accent'))}, ledger=${await page.locator('[data-summary-accent]').innerText()}, pressed=${await page.getAttribute('[data-accent-choice="sage"]', 'aria-pressed')}`
  );
  await page.click('[data-accent-choice="terracotta"]');
  await page.waitForTimeout(250);

  /* Theme */
  await page.click('[data-theme-choice="dark"]');
  await page.waitForTimeout(320);
  prefs = await getPrefs();
  notes.push(`[desktop/light] theme dark: html=${prefs.theme}, stored=${prefs.themePref}`);
  await page.screenshot({ path: `${out}/phase8-settings-desktop-dark-live.png`, fullPage: true });
  await page.click('[data-theme-choice="light"]');
  await page.waitForTimeout(250);
  prefs = await getPrefs();
  notes.push(`[desktop/light] theme light: html=${prefs.theme}, stored=${prefs.themePref}`);

  /* Pip colourway */
  await page.click('[data-mascot-choice="clay"]');
  await page.waitForTimeout(320);
  prefs = await getPrefs();
  notes.push(`[desktop/light] mascot clay: html=${prefs.mascot}, --pip-pod=${prefs.pipPod}, pressed=${await page.getAttribute('[data-mascot-choice="clay"]', 'aria-pressed')}`);
  await page.click('[data-mascot-choice="classic"]');
  await page.waitForTimeout(250);

  /* Avatar style */
  await page.click('[data-avatar-style="pip"]');
  await page.waitForTimeout(320);
  prefs = await getPrefs();
  notes.push(`[desktop/light] avatar pip: shell=${prefs.avatarPip}, mark="${prefs.avatarText}"`);
  await page.locator('.settings-card').first().screenshot({ path: `${out}/phase8-profile-avatar.png` });
  await page.click('[data-avatar-style="initials"]');
  await page.waitForTimeout(250);

  /* Profile validation + save */
  await page.fill('#settings-name', '');
  await page.click('[data-profile-form] button[type="submit"]');
  await page.waitForTimeout(200);
  notes.push(`[desktop/light] empty name error="${await page.locator('[data-profile-error]').innerText()}", focused=${await page.evaluate(() => document.activeElement?.id)}`);
  await page.fill('#settings-name', 'Maya Quinn');
  await page.fill('#settings-email', 'not-an-email');
  await page.click('[data-profile-form] button[type="submit"]');
  await page.waitForTimeout(200);
  notes.push(`[desktop/light] bad email error="${await page.locator('[data-profile-error]').innerText()}"`);
  await page.fill('#settings-email', 'maya.q@example.com');
  await page.click('[data-profile-form] button[type="submit"]');
  await page.waitForTimeout(500);
  prefs = await getPrefs();
  notes.push(`[desktop/light] profile saved: shell="${prefs.name}", ledger="${prefs.ledgerName}", initials="${prefs.avatarText}"`);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('[data-profile-form]');
  await page.waitForTimeout(350);
  notes.push(`[desktop/light] profile after reload: name="${await page.inputValue('#settings-name')}", email="${await page.inputValue('#settings-email')}"`);

  /* Restore profile */
  await page.fill('#settings-name', 'Maya Chen');
  await page.fill('#settings-email', 'maya.chen@example.com');
  await page.click('[data-profile-form] button[type="submit"]');
  await page.waitForTimeout(400);
  notes.push(`[desktop/light] profile restored: shell="${(await getPrefs()).name}"`);

  /* Working hours validation + save */
  await page.fill('#work-start', '18:00');
  await page.fill('#work-end', '09:00');
  await page.click('[data-hours-form] button[type="submit"]');
  await page.waitForTimeout(200);
  notes.push(`[desktop/light] bad hours error="${await page.locator('[data-hours-error]').innerText()}", ledger="${await page.locator('[data-summary-hours]').innerText()}"`);
  await page.fill('#work-start', '09:30');
  await page.fill('#work-end', '16:30');
  await page.click('[data-hours-form] button[type="submit"]');
  await page.waitForTimeout(450);
  notes.push(`[desktop/light] hours saved ledger="${await page.locator('[data-summary-hours]').innerText()}"`);
  await page.fill('#work-start', '09:00');
  await page.fill('#work-end', '17:30');
  await page.click('[data-hours-form] button[type="submit"]');
  await page.waitForTimeout(350);
  notes.push(`[desktop/light] hours restored ledger="${await page.locator('[data-summary-hours]').innerText()}"`);

  /* AI toggle persistence */
  await page.uncheck('[data-ai-toggle]');
  await page.waitForTimeout(350);
  notes.push(`[desktop/light] ai off: note="${(await page.locator('[data-ai-note]').innerText()).slice(0, 28)}...", checked=${await page.isChecked('[data-ai-toggle]')}`);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('[data-ai-toggle]');
  await page.waitForTimeout(300);
  notes.push(`[desktop/light] ai persisted off: checked=${await page.isChecked('[data-ai-toggle]')}`);
  await page.check('[data-ai-toggle]');
  await page.waitForTimeout(300);

  /* Export one table */
  const [taskDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.click('[data-export-quick="tasks"]'),
  ]);
  const taskCsv = fs.readFileSync(await taskDownload.path(), 'utf8');
  const taskLines = taskCsv.replace(/^\ufeff/, '').trimEnd().split('\r\n');
  notes.push(
    `[desktop/light] tasks CSV: file=${taskDownload.suggestedFilename()}, header="${taskLines[0]}", rows=${taskLines.length - 1}`
  );
  if (!taskCsv.startsWith('\ufeff')) problems.push('[desktop/light] tasks CSV missing BOM');
  if (!taskLines[0].startsWith('Title,Status,Priority,Due')) problems.push('[desktop/light] tasks CSV header wrong');

  /* Export everything from the sheet */
  await page.click('.page-head [data-export]');
  await page.waitForSelector('dialog.sheet[open] [data-export-kind="all"]');
  await page.waitForTimeout(350);
  await clearToasts(page);
  await page.screenshot({ path: `${out}/phase8-export-sheet.png` });
  const [allDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.click('[data-export-kind="all"]'),
  ]);
  const allCsv = fs.readFileSync(await allDownload.path(), 'utf8');
  const allLines = allCsv.replace(/^\ufeff/, '').trimEnd().split('\r\n');
  const statsTotal = await page.evaluate(() =>
    Number(document.querySelector('[data-summary-records]').textContent.replace(/\D/g, ''))
  );
  notes.push(
    `[desktop/light] all CSV: file=${allDownload.suggestedFilename()}, rows=${allLines.length - 1}, statsTotal=${statsTotal}, header="${allLines[0]}"`
  );
  if (allLines.length - 1 !== statsTotal) {
    problems.push(`[desktop/light] all CSV rows ${allLines.length - 1} != stats total ${statsTotal}`);
  }

  /* Install help */
  await page.click('.page-head [data-install]');
  await page.waitForSelector('dialog.sheet[open] .install-steps');
  const installSteps = await page.locator('dialog.sheet[open] .install-steps li').count();
  await clearToasts(page);
  await page.screenshot({ path: `${out}/phase8-install-sheet.png` });
  notes.push(`[desktop/light] install help steps=${installSteps}`);
  if (installSteps !== 3) problems.push('[desktop/light] install help should have 3 steps');
  await page.click('dialog.sheet[open] [data-close-sheet]');
  await page.waitForTimeout(250);

  /* Reset demo */
  await page.click('[data-reset]');
  await page.waitForSelector('dialog.sheet[open] [data-ok]');
  await page.screenshot({ path: `${out}/phase8-reset-confirm.png` });
  await page.click('dialog.sheet[open] [data-ok]');
  await page.waitForFunction(() => location.hash === '#/dashboard', null, { timeout: 10000 });
  await page.waitForSelector('.dashboard');
  await page.waitForTimeout(500);
  notes.push(
    `[desktop/light] reset: route=${await page.evaluate(() => location.hash)}, name="${await page.locator('[data-profile-name]').innerText()}"`
  );
  await openSettings(page);
  const resetGlance = await page.evaluate(() => ({
    name: document.querySelector('[data-summary-name]').textContent,
    total: document.querySelector('[data-summary-records]').textContent,
    hours: document.querySelector('[data-summary-hours]').textContent,
    ai: document.querySelector('[data-ai-toggle]').checked,
    mascot: document.documentElement.dataset.mascot,
    accent: document.documentElement.dataset.accent,
    avatar: document.querySelector('.profile-chip .avatar')?.textContent.trim(),
  }));
  notes.push(`[desktop/light] prefs after reset: ${JSON.stringify(resetGlance)}`);
  if (resetGlance.name !== 'Maya Chen') problems.push('[desktop/light] reset lost name');
  if (resetGlance.hours !== '9:00–17:30') problems.push('[desktop/light] reset lost working hours');
  if (!resetGlance.ai) problems.push('[desktop/light] reset lost AI preference');
  if (resetGlance.mascot !== 'classic' || resetGlance.accent !== 'terracotta') {
    problems.push('[desktop/light] reset lost appearance preferences');
  }

  await context.close();
}

/* Mobile viewport check at several scroll positions (fullPage fixed-bar artefacts) */
{
  const { context, page } = await newPage({ width: 360, height: 800 }, 'light');
  await seed(page);
  await openSettings(page);
  await clearToasts(page);
  for (const [i, y] of [0, 1200, 2400].entries()) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${out}/phase8-settings-phone-scroll-${i + 1}.png` });
  }
  notes.push(
    `[phone/light] scrolled screenshots: ${await page.evaluate(() => `${document.documentElement.scrollHeight}px page, tabbar fixed`)}`
  );
  await context.close();
}

await browser.close();

const summary = `${notes.join('\n')}\n\n${problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'CLEAN: no console errors, no overflow, checks passed.'}\n`;
fs.writeFileSync(`${out}/phase8-notes.txt`, summary);
console.log(summary);
if (problems.length) process.exitCode = 1;
