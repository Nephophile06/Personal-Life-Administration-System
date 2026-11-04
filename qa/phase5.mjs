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
  const context = await browser.newContext({ viewport, colorScheme: theme });
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

for (const [label, viewport] of sizes) {
  for (const theme of ['light', 'dark']) {
    const { context, page } = await newPage(viewport, theme);
    await seed(page);

    /* ---------------- Tasks ---------------- */
    await page.goto(`${base}#/tasks`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.tasks-page .task-row');
    await page.waitForTimeout(500);
    await clearToasts(page);
    await page.screenshot({ path: `${out}/phase5-tasks-${label}-${theme}.png`, fullPage: true });

    const taskGlance = await page.evaluate(() => ({
      open: document.querySelector('[data-ledger-cell="accent"] .ledger-cell__value')?.textContent,
      overdue: document.querySelector('[data-ledger-cell="danger"] .ledger-cell__value')?.textContent,
      groups: [...document.querySelectorAll('.task-group__head h2')].map((h) => h.textContent),
      rows: document.querySelectorAll('.task-row').length,
      rail: document.querySelectorAll('.tasks-rail .rail-card').length,
      countToday: document.querySelector('[data-count="today"]')?.textContent,
    }));
    notes.push(`[${label}/${theme}] tasks: ${JSON.stringify(taskGlance)}`);

    if (label === 'desktop' && theme === 'light') {
      // Quick add
      const openBefore = await page.locator('[data-ledger-cell="accent"] .ledger-cell__value').textContent();
      await page.fill('.quick-add__input', 'QA — replace the kitchen filter');
      await page.press('.quick-add__input', 'Enter');
      await page.waitForTimeout(550);
      const openAfter = await page.locator('[data-ledger-cell="accent"] .ledger-cell__value').textContent();
      const addedRow = page.locator('.task-row', { hasText: 'replace the kitchen filter' }).first();
      notes.push(`[desktop/light] quick add open ${openBefore} -> ${openAfter}, row=${await addedRow.count()}`);

      // Edit through the sheet
      await addedRow.locator('.task-title').click();
      await page.waitForSelector('dialog.sheet[open]');
      const sheetHeading = await page.locator('dialog.sheet[open] .sheet__head h2').textContent();
      await page.fill('#task-estimate', '45');
      await page.click('[data-priority="high"]');
      await page.screenshot({ path: `${out}/phase5-task-editor.png`, fullPage: true });
      await page.click('[data-save]');
      await page.waitForSelector('dialog.sheet', { state: 'detached' });
      await page.waitForTimeout(450);
      const editedRow = page.locator('.task-row', { hasText: 'replace the kitchen filter' }).first();
      const meta = await editedRow.locator('.task-meta').innerText();
      notes.push(`[desktop/light] editor "${sheetHeading}" -> meta "${meta.replace(/\n/g, ' | ')}"`);

      // Complete it
      await editedRow.locator('[data-check]').click();
      await page.waitForTimeout(500);
      const openDone = await page.locator('[data-ledger-cell="accent"] .ledger-cell__value').textContent();
      const doneCount = await page.locator('[data-count="done"]').textContent();
      notes.push(`[desktop/light] complete -> open=${openDone}, done tab=${doneCount}`);

      // Expand a detailed task
      const expand = page.locator('[data-expand]').first();
      if (await expand.count()) {
        await expand.click();
        await page.waitForTimeout(250);
        await clearToasts(page);
        await page.screenshot({ path: `${out}/phase5-tasks-expanded.png`, fullPage: true });
      }

      // Filter + sort + reorder via menu
      await page.click('[data-filter="overdue"]');
      await page.waitForTimeout(200);
      const overdueOnly = await page.evaluate(() =>
        [...document.querySelectorAll('.task-row')].every((r) => r.classList.contains('is-overdue'))
      );
      await page.click('[data-filter="all"]');
      await page.waitForTimeout(200);
      const firstName = await page.locator('.task-title').first().textContent();
      await page.locator('.task-row').first().locator('.row-menu > summary').click();
      await page.locator('.task-row').first().locator('[data-act="down"]').click();
      await page.waitForTimeout(450);
      const secondName = await page.locator('.task-title').nth(1).textContent();
      notes.push(`[desktop/light] overdue filter only=${overdueOnly}, reorder "${firstName}" -> second="${secondName}"`);

      // Editor on an existing task
      await page.locator('.task-title').nth(1).click();
      await page.waitForSelector('dialog.sheet[open]');
      await page.click('[data-cancel]');
      await page.waitForSelector('dialog.sheet', { state: 'detached' });
    }

    /* ---------------- Planner ---------------- */
    await page.goto(`${base}#/planner`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.planner-page .plan-timeline, .planner-page .plan-empty', { timeout: 8000 });
    await page.waitForTimeout(500);
    await clearToasts(page);
    await page.screenshot({ path: `${out}/phase5-planner-${label}-${theme}.png`, fullPage: true });

    const planGlance = await page.evaluate(() => ({
      status: document.querySelector('[data-plan-status]')?.textContent,
      blocks: document.querySelectorAll('.plan-block').length,
      bills: document.querySelectorAll('.plan-block[data-kind="bill"]').length,
      breaks: document.querySelectorAll('.plan-block--break').length,
      focus: document.querySelector('.plan-stat strong')?.textContent,
      rail: document.querySelectorAll('.planner-rail .rail-card').length,
      unplanned: document.querySelectorAll('.unplanned li').length,
      weights: document.querySelectorAll('[data-weight]').length,
    }));
    notes.push(`[${label}/${theme}] planner: ${JSON.stringify(planGlance)}`);

    if (label === 'desktop' && theme === 'light') {
      const firstTitle = await page.locator('.plan-block').first().locator('h3').textContent();
      await page.click('[data-accept]');
      await page.waitForTimeout(500);
      const accepted = await page.locator('[data-plan-status]').textContent();
      await clearToasts(page);
      await page.screenshot({ path: `${out}/phase5-planner-accepted.png`, fullPage: true });

      const workBlocks = page.locator('.plan-block[data-kind="task"], .plan-block[data-kind="bill"]');
      const beforeOrder = await workBlocks.locator('h3').allTextContents();
      await workBlocks.first().locator('[data-block-down]').click();
      await page.waitForTimeout(550);
      const afterOrder = await workBlocks.locator('h3').allTextContents();
      notes.push(`[desktop/light] accepted=${accepted}, first="${firstTitle}", move ${JSON.stringify(beforeOrder.slice(0, 2))} -> ${JSON.stringify(afterOrder.slice(0, 2))}`);

      // Weights -> regenerate
      await page.locator('[data-weight="effort"]').evaluate((el) => {
        el.value = '40';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await page.click('[data-apply-weights]');
      await page.waitForTimeout(700);
      const afterWeights = await page.evaluate(() => ({
        status: document.querySelector('[data-plan-status]')?.textContent,
        effort: document.querySelector('[data-weight="effort"]')?.value,
      }));
      notes.push(`[desktop/light] weights: ${JSON.stringify(afterWeights)}`);
      await clearToasts(page);
      await page.screenshot({ path: `${out}/phase5-planner-regenerated.png`, fullPage: true });

      // Day navigation
      await page.click('[data-day="1"]');
      await page.waitForTimeout(500);
      const tomorrow = await page.evaluate(() => ({
        date: document.querySelector('[data-day-date]')?.textContent,
        empty: Boolean(document.querySelector('.plan-empty')),
        todayChip: !document.querySelector('[data-day-today]')?.hidden,
      }));
      notes.push(`[desktop/light] next day: ${JSON.stringify(tomorrow)}`);
      await page.screenshot({ path: `${out}/phase5-planner-empty-day.png`, fullPage: true });
      await page.click('[data-day-today]');
      await page.waitForTimeout(500);
    }

    await context.close();
  }
}

await browser.close();
fs.writeFileSync(`${out}/phase5-notes.txt`, notes.join('\n'));
fs.writeFileSync(`${out}/phase5-problems.txt`, problems.join('\n') || 'no console errors');
console.log(notes.join('\n'));
console.log(problems.length ? `\nPROBLEMS:\n${problems.join('\n')}` : '\nCLEAN: no console errors');
