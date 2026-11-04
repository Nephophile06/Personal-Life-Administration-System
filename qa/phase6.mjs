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

const overlap = (page) =>
  page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

for (const [label, viewport] of sizes) {
  for (const theme of ['light', 'dark']) {
    const { context, page } = await newPage(viewport, theme);
    await seed(page);

    /* ---------------- Bills ---------------- */
    await page.goto(`${base}#/bills`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.bills-page .bill-row');
    await page.waitForTimeout(450);
    await clearToasts(page);
    await page.screenshot({ path: `${out}/phase6-bills-${label}-${theme}.png`, fullPage: true });

    const billGlance = await page.evaluate(() => ({
      rows: document.querySelectorAll('.bill-row').length,
      groups: [...document.querySelectorAll('.bill-group__head h2')].map((h) =>
        h.textContent.replace(/\s+/g, ' ').trim()
      ),
      overdue: document.querySelector('[data-ledger-cell="danger"] .ledger-cell__value')?.textContent,
      week: document.querySelector('[data-ledger-cell="ochre"] .ledger-cell__value')?.textContent,
      rhythm: document.querySelector('[data-ledger-cell="accent"] .ledger-cell__value')?.textContent,
      rail: document.querySelectorAll('.bills-rail .rail-card').length,
      next: [...document.querySelectorAll('.bill-next li')].map((li) =>
        li.textContent.replace(/\s+/g, ' ').trim()
      ),
      overflow: document.documentElement.scrollWidth - window.innerWidth,
    }));
    notes.push(`[${label}/${theme}] bills: ${JSON.stringify(billGlance)}`);

    if (label === 'desktop' && theme === 'light') {
      const totalBefore = await page.locator('[data-ledger-cell="accent"] .ledger-cell__value').textContent();
      // Pay an overdue bill
      const overdueRow = page.locator('.bill-row[data-tone="overdue"]').first();
      const paidName = (await overdueRow.locator('h3').textContent()).trim();
      const paidId = await overdueRow.getAttribute('data-id');
      const overdueBefore = await page.locator('[data-ledger-cell="danger"] .ledger-cell__value').textContent();
      await overdueRow.locator('[data-action="pay"]').click();
      await page.waitForSelector('dialog.sheet[open] #pay-form');
      const preview = await page.locator('dialog.sheet[open] [data-next-due]').textContent();
      await page.click('dialog.sheet[open] [data-save]');
      await page.waitForSelector('dialog.sheet', { state: 'detached' });
      await page.waitForTimeout(650);
      const overdueAfter = await page.locator('[data-ledger-cell="danger"] .ledger-cell__value').textContent();
      const paidRow = page.locator(`.bill-row[data-id="${paidId}"]`);
      const paidDue = (await paidRow.locator('.bill-due').textContent()).trim();
      notes.push(`[desktop/light] paid "${paidName}" overdue ${overdueBefore}->${overdueAfter}, preview "${preview}", row due "${paidDue}"`);

      // Payment history
      await paidRow.locator('summary').first().click();
      await paidRow.locator('[data-action="history"]').click();
      await page.waitForSelector('dialog.sheet[open] .pay-history');
      const historyRows = await page.locator('dialog.sheet[open] .pay-history li').count();
      const historyText = await page.locator('dialog.sheet[open] .pay-history li').first().innerText();
      notes.push(`[desktop/light] history rows=${historyRows}, first="${historyText.replace(/\n/g, ' | ')}"`);
      await page.screenshot({ path: `${out}/phase6-bills-history.png`, fullPage: true });
      await page.click('dialog.sheet[open] [data-cancel]');
      await page.waitForSelector('dialog.sheet', { state: 'detached' });

      // Add a bill
      await page.click('[data-action="add-bill"]');
      await page.waitForSelector('dialog.sheet[open] #bill-form');
      await page.fill('#bill-name', 'QA streaming');
      await page.fill('#bill-amount', '12.50');
      await page.screenshot({ path: `${out}/phase6-bills-editor.png`, fullPage: true });
      await page.click('dialog.sheet[open] [data-save]');
      await page.waitForSelector('dialog.sheet', { state: 'detached' });
      await page.waitForTimeout(600);
      const addedBill = page.locator('.bill-row', { hasText: 'QA streaming' }).first();
      const addedCount = await addedBill.count();
      const addedAmount = addedCount ? (await addedBill.locator('.bill-money strong').textContent()).trim() : '';
      notes.push(`[desktop/light] add bill count=${addedCount} amount=${addedAmount}`);

      // Edit it
      await addedBill.locator('summary').first().click();
      await addedBill.locator('[data-action="edit"]').click();
      await page.waitForSelector('dialog.sheet[open] #bill-form');
      await page.fill('#bill-amount', '13.25');
      await page.click('dialog.sheet[open] [data-save]');
      await page.waitForSelector('dialog.sheet', { state: 'detached' });
      await page.waitForTimeout(600);
      const editedAmount = (await page.locator('.bill-row', { hasText: 'QA streaming' }).first().locator('.bill-money strong').textContent()).trim();
      notes.push(`[desktop/light] edit bill amount -> ${editedAmount}`);

      // Delete it
      const editedBill = page.locator('.bill-row', { hasText: 'QA streaming' }).first();
      await editedBill.locator('summary').first().click();
      await editedBill.locator('[data-action="delete"]').click();
      await page.waitForSelector('dialog.sheet[open] [data-ok]');
      await page.screenshot({ path: `${out}/phase6-bills-confirm.png`, fullPage: true });
      await page.click('dialog.sheet[open] [data-ok]');
      await page.waitForSelector('dialog.sheet', { state: 'detached' });
      await page.waitForTimeout(600);
      const afterDelete = await page.locator('.bill-row', { hasText: 'QA streaming' }).count();
      notes.push(`[desktop/light] delete bill remaining=${afterDelete}, monthly rhythm ${totalBefore}->${await page.locator('[data-ledger-cell="accent"] .ledger-cell__value').textContent()}`);
      await clearToasts(page);
      await page.screenshot({ path: `${out}/phase6-bills-after.png`, fullPage: true });
    }

    /* ---------------- Money ---------------- */
    await page.goto(`${base}#/money`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.money-page .tx-row');
    await page.waitForFunction(() => document.querySelectorAll('[data-chart]').length >= 2, null, { timeout: 8000 });
    await page.waitForTimeout(2600);
    await clearToasts(page);
    await page.screenshot({ path: `${out}/phase6-money-${label}-${theme}.png`, fullPage: true });

    const moneyGlance = await page.evaluate(() => ({
      spent: document.querySelectorAll('.ledger-cell__value')[0]?.textContent,
      income: document.querySelectorAll('.ledger-cell__value')[1]?.textContent,
      net: document.querySelectorAll('.ledger-cell__value')[2]?.textContent,
      budget: document.querySelectorAll('.ledger-cell__value')[3]?.textContent,
      rows: document.querySelectorAll('.tx-row').length,
      budgets: document.querySelectorAll('.budget-row').length,
      legend: document.querySelectorAll('.chart-legend li').length,
      canvases: [...document.querySelectorAll('[data-chart]')].map((c) => ({
        kind: c.dataset.chart,
        w: c.width,
        h: c.height,
      })),
      fallbacks: document.querySelectorAll('.chart-fallback:not([hidden])').length,
      donutColors: (() => {
        const c = window.Chart?.getChart(document.querySelector('[data-chart="category"]'));
        return c ? new Set(c.data.datasets[0].backgroundColor).size : 0;
      })(),
      yTicks: window.Chart?.getChart(document.querySelector('[data-chart="trend"]'))?.scales?.y?.ticks?.map((t) => t.label),
      txOverflow: (() => {
        const card = document.querySelector('.tx-card')?.getBoundingClientRect();
        if (!card) return 0;
        return [...document.querySelectorAll('.tx-row')].filter((r) => {
          const b = r.getBoundingClientRect();
          return b.right > card.right + 1;
        }).length;
      })(),
      month: document.querySelector('.month-nav__label strong')?.textContent,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
    }));
    notes.push(`[${label}/${theme}] money: ${JSON.stringify(moneyGlance)}`);

    if (label === 'desktop' && theme === 'light') {
      // Filters
      const filterCheck = {};
      for (const type of ['expense', 'income', 'all']) {
        await page.click(`[data-filter="${type}"]`);
        await page.waitForTimeout(180);
        filterCheck[type] = await page.evaluate(
          (t) =>
            [...document.querySelectorAll('.tx-row')].every(
              (r) => t === 'all' || r.dataset.type === t
            ) && document.querySelectorAll('.tx-row').length,
          type
        );
      }
      notes.push(`[desktop/light] filters: ${JSON.stringify(filterCheck)}`);

      // Previous month
      const thisMonthExpenseCount = await page.locator('.tx-row[data-type="expense"]').count();
      await page.click('[data-action="prev-month"]');
      await page.waitForTimeout(1300);
      const prevMonth = await page.evaluate(() => ({
        label: document.querySelector('.month-nav__label strong')?.textContent,
        chip: Boolean(document.querySelector('[data-action="this-month"]')),
        expenses: document.querySelectorAll('.tx-row[data-type="expense"]').length,
      }));
      notes.push(`[desktop/light] prev month ${JSON.stringify(prevMonth)}, current expenses=${thisMonthExpenseCount}`);
      await page.screenshot({ path: `${out}/phase6-money-prevmonth.png`, fullPage: true });
      await page.click('[data-action="this-month"]');
      await page.waitForTimeout(1300);

      // Add an expense
      const spentBefore = parseFloat(
        (await page.locator('.ledger-cell__value').nth(0).textContent()).replace(/[^0-9.]/g, '')
      );
      await page.click('[data-action="add-expense"]');
      await page.waitForSelector('dialog.sheet[open] #tx-form');
      await page.fill('#tx-amount', '42.75');
      await page.fill('#tx-note', 'QA tea and cake');
      await page.screenshot({ path: `${out}/phase6-money-expense-editor.png`, fullPage: true });
      await page.click('dialog.sheet[open] [data-save]');
      await page.waitForSelector('dialog.sheet', { state: 'detached' });
      await page.waitForTimeout(1300);
      const spentAfter = parseFloat(
        (await page.locator('.ledger-cell__value').nth(0).textContent()).replace(/[^0-9.]/g, '')
      );
      const teaRow = page.locator('.tx-row', { hasText: 'QA tea and cake' }).first();
      notes.push(`[desktop/light] add expense spent ${spentBefore}->${spentAfter}, row=${await teaRow.count()}`);

      // Edit it
      await teaRow.locator('summary').first().click();
      await teaRow.locator('[data-action="edit-tx"]').click();
      await page.waitForSelector('dialog.sheet[open] #tx-form');
      await page.fill('#tx-amount', '50');
      await page.click('dialog.sheet[open] [data-save]');
      await page.waitForSelector('dialog.sheet', { state: 'detached' });
      await page.waitForTimeout(1300);
      const editedTea = await page.locator('.tx-row', { hasText: 'QA tea and cake' }).first().locator('.tx-amount').textContent();
      notes.push(`[desktop/light] edit expense -> ${editedTea}`);

      // Budget warning: drive a budget over its limit
      const firstBudget = page.locator('.budget-row').first();
      const budgetCat = await firstBudget.getAttribute('data-category');
      await firstBudget.locator('[data-action="edit-budget"]').click();
      await page.waitForSelector('dialog.sheet[open] #budget-form');
      await page.fill('#budget-limit', '10');
      await page.click('dialog.sheet[open] [data-save]');
      await page.waitForSelector('dialog.sheet', { state: 'detached' });
      await page.waitForTimeout(1300);
      const overState = await page.evaluate((cat) => {
        const row = document.querySelector(`.budget-row[data-category="${cat}"]`);
        return {
          level: row?.querySelector('.bar__fill')?.dataset.level,
          percent: row?.querySelector('.tag')?.textContent,
          note: row?.querySelector('.budget-left')?.textContent,
          ledger: document.querySelectorAll('.ledger-cell__value')[3]?.textContent,
        };
      }, budgetCat);
      notes.push(`[desktop/light] budget over (${budgetCat}): ${JSON.stringify(overState)}`);
      await clearToasts(page);
      await page.screenshot({ path: `${out}/phase6-money-budget-over.png`, fullPage: true });

      // Every category is already set, so the add control is replaced
      const addWhenFull = await page.locator('[data-action="add-budget"]').count();
      const fullNote = await page.locator('.budgets-card .card-head .tiny').textContent();
      notes.push(`[desktop/light] add-budget when full=${addWhenFull}, note="${fullNote.trim()}"`);

      // Remove one budget, then add it back
      const budgetCountBefore = await page.locator('.budget-row').count();
      const funRow = page.locator('.budget-row[data-category="fun"]');
      await funRow.locator('[data-action="edit-budget"]').click();
      await page.waitForSelector('dialog.sheet[open] #budget-form');
      await page.click('dialog.sheet[open] [data-delete]');
      await page.waitForSelector('dialog.sheet[open] [data-ok]');
      await page.click('dialog.sheet[open] [data-ok]');
      await page.waitForSelector('dialog.sheet', { state: 'detached' });
      await page.waitForTimeout(1300);
      const budgetCountAfterRemove = await page.locator('.budget-row').count();

      await page.click('[data-action="add-budget"]');
      await page.waitForSelector('dialog.sheet[open] #budget-form');
      const options = await page.locator('dialog.sheet[open] #budget-category option').count();
      const onlyChoice = await page.locator('dialog.sheet[open] #budget-category option').first().getAttribute('value');
      await page.fill('#budget-limit', '55');
      await page.click('dialog.sheet[open] [data-save]');
      await page.waitForSelector('dialog.sheet', { state: 'detached' });
      await page.waitForTimeout(1300);
      const budgetCountAfter = await page.locator('.budget-row').count();
      notes.push(`[desktop/light] budgets ${budgetCountBefore} -> remove ${budgetCountAfterRemove} -> add options=${options} (${onlyChoice}) ${budgetCountAfter}`);

      // The restored budget should track 55
      const restored = await page.locator('.budget-row[data-category="fun"] .budget-amount').textContent();
      notes.push(`[desktop/light] restored fun budget: ${restored.replace(/\s+/g, ' ').trim()}`);

      // Delete the QA expense
      const teaAgain = page.locator('.tx-row', { hasText: 'QA tea and cake' }).first();
      await teaAgain.locator('summary').first().click();
      await teaAgain.locator('[data-action="delete-tx"]').click();
      await page.waitForSelector('dialog.sheet[open] [data-ok]');
      await page.click('dialog.sheet[open] [data-ok]');
      await page.waitForSelector('dialog.sheet', { state: 'detached' });
      await page.waitForTimeout(1300);
      notes.push(`[desktop/light] delete expense remaining=${await page.locator('.tx-row', { hasText: 'QA tea and cake' }).count()}`);
      await clearToasts(page);
      await page.screenshot({ path: `${out}/phase6-money-final.png`, fullPage: true });

      // Empty month far in the past: charts and cards should degrade kindly
      for (let i = 0; i < 12; i += 1) {
        await page.click('[data-action="prev-month"]');
        await page.waitForTimeout(320);
      }
      await page.waitForTimeout(1500);
      const emptyMonth = await page.evaluate(() => ({
        month: document.querySelector('.month-nav__label strong')?.textContent,
        txEmpty: Boolean(document.querySelector('.tx-empty')),
        budgetEmpty: Boolean(document.querySelector('.budgets-card .mini-empty')),
        chartEmpty: Boolean(document.querySelector('.chart-empty')),
        budgetRows: document.querySelectorAll('.budget-row').length,
        gapChart: Boolean(document.querySelector('[data-chart="budget"]')),
      }));
      notes.push(`[desktop/light] empty month: ${JSON.stringify(emptyMonth)}`);
      await clearToasts(page);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: `${out}/phase6-money-empty.png`, fullPage: true });
      await page.click('[data-action="this-month"]');
      await page.waitForTimeout(2400);

      // Theme switch should redraw charts without errors
      await page.click('[data-theme-toggle]');
      await page.waitForTimeout(1400);
      const themed = await page.evaluate(() => ({
        theme: document.documentElement.dataset.theme,
        charts: document.querySelectorAll('[data-chart]').length,
        canvases: [...document.querySelectorAll('[data-chart]')].map((c) => {
          const chart = window.Chart?.getChart(c);
          return chart ? chart.data.datasets.length : 0;
        }),
      }));
      notes.push(`[desktop/light] theme toggle: ${JSON.stringify(themed)}`);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: `${out}/phase6-money-toggled.png`, fullPage: true });
      await page.click('[data-theme-toggle]');
      await page.waitForTimeout(800);
    }

    await context.close();
  }
}

await browser.close();
fs.writeFileSync(`${out}/phase6-notes.txt`, notes.join('\n'));
fs.writeFileSync(`${out}/phase6-problems.txt`, problems.join('\n') || 'no console errors');
console.log(notes.join('\n'));
console.log(problems.length ? `\nPROBLEMS:\n${problems.join('\n')}` : '\nCLEAN: no console errors');
