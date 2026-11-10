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

const ready = async (route) => {
  await page.waitForFunction(
    (r) => document.documentElement.dataset.route === r,
    route,
    { timeout: 8000 }
  );
  await page.waitForTimeout(450);
};

await page.goto(`${BASE}#/welcome`, { waitUntil: 'networkidle' });
await page.locator('[data-demo]').click();
await ready('dashboard');

/* ---- Settings: nudge preferences + reminder window ---------------------- */
await page.goto(`${BASE}#/settings`, { waitUntil: 'networkidle' });
await page.waitForSelector('[data-notify-toggle]');
const nudgeCount = await page.locator('[data-notify-toggle]').count();
const leadBefore = await page.locator('#remind-days').inputValue();
const billsToggle = page.locator('[data-notify-toggle="notifyBills"]');
await billsToggle.uncheck();
await page.waitForTimeout(350);
const toggledOff = !(await billsToggle.isChecked());
await billsToggle.check();
await page.waitForTimeout(350);
const toggledOn = await billsToggle.isChecked();
await page.fill('#remind-days', '5');
await page.locator('[data-remind-form] button[type="submit"]').click();
await page.waitForTimeout(500);
await page.locator('[data-remind-form]').scrollIntoViewIfNeeded();
await page.screenshot({ path: path.join(OUT, 'gaps-settings-desktop.png'), fullPage: true });

await page.goto(`${BASE}#/dashboard`, { waitUntil: 'networkidle' });
await ready('dashboard');
await page.goto(`${BASE}#/settings`, { waitUntil: 'networkidle' });
await page.waitForSelector('#remind-days');
const leadAfter = await page.locator('#remind-days').inputValue();
console.log('settings nudges:', { nudgeCount, leadBefore, leadAfter, toggledOff, toggledOn });

/* ---- Tasks: scores, Puffy’s order, audit history ------------------------ */
await page.goto(`${BASE}#/tasks`, { waitUntil: 'networkidle' });
await page.waitForSelector('.task-row');
const scoreChips = await page.locator('.task-priority-score').count();
const firstOpen = page.locator('.task-row:not(.is-done)').first();
const firstId = await firstOpen.getAttribute('data-id');
await firstOpen.locator('[data-check]').click();
await page.waitForTimeout(700);
await page.locator('.task-group--done > summary').click();
await page.waitForTimeout(250);
const doneRow = page.locator(`.task-row[data-id="${firstId}"]`);
await doneRow.locator('[data-expand]').click();
await page.waitForTimeout(300);
const historyLines = await page.locator(`.task-row[data-id="${firstId}"] .task-history li`).allTextContents();

await page.locator('[data-sort]').selectOption('puffy');
await page.waitForTimeout(300);
const sortedScoreText = await page
  .locator('.task-row:not(.is-done) .task-priority-score')
  .allTextContents();
const sortedScores = sortedScoreText.map((t) => Number(t.replace(/[^\d.]/g, '')));
const sortedDesc = sortedScores.every((n, i) => i === 0 || sortedScores[i - 1] >= n);

const openWithDetail = page.locator('.task-row:not(.is-done) [data-expand]').first();
if (await openWithDetail.count()) {
  await openWithDetail.click();
  await page.waitForTimeout(250);
}
const scorePanel = await page.locator('.task-score-panel').count();
console.log('tasks:', { scoreChips, historyLines, sortedScores, sortedDesc, scorePanel });
await page.locator('.tasks-main').scrollIntoViewIfNeeded();
await page.screenshot({ path: path.join(OUT, 'gaps-tasks-desktop.png'), fullPage: true });

/* ---- Planner: score chip on blocks -------------------------------------- */
await page.goto(`${BASE}#/planner`, { waitUntil: 'networkidle' });
await page.waitForSelector('.plan-block', { timeout: 8000 });
await page.waitForTimeout(700);
const planScores = await page.locator('.plan-block__score').count();
console.log('planner score chips:', planScores);
await page.screenshot({ path: path.join(OUT, 'gaps-planner-desktop.png'), fullPage: true });

/* ---- Bills: per-bill reminder window ------------------------------------ */
await page.goto(`${BASE}#/bills`, { waitUntil: 'networkidle' });
await page.waitForSelector('.bill-row');
await page.locator('[data-action="add-bill"]').first().click();
await page.waitForSelector('#bill-name');
await page.fill('#bill-name', 'QA reminder bill');
await page.fill('#bill-amount', '12.34');
await page.fill('#bill-remind', '7');
await page.locator('.sheet [data-save]').click();
await page.waitForTimeout(900);
const newBillText = await page
  .locator('.bill-row', { hasText: 'QA reminder bill' })
  .first()
  .textContent();
const billReminderOk = /Reminder 7d before/.test(newBillText || '');
console.log('bill reminder:', { billReminderOk });
await page.screenshot({ path: path.join(OUT, 'gaps-bills-desktop.png'), fullPage: true });

/* ---- Habits: animated streak counters settle on their value ------------- */
await page.goto(`${BASE}#/habits`, { waitUntil: 'networkidle' });
await page.waitForSelector('[data-streak-count]');
await page.waitForTimeout(1300);
const streaks = await page.locator('[data-streak-count]').evaluateAll((els) =>
  els.map((el) => ({ target: Number(el.dataset.streakCount), text: el.textContent.trim() }))
);
const streaksSettled = streaks.every((s) => Number(s.text) === s.target);
console.log('habit streaks:', { streaks, streaksSettled });
await page.screenshot({ path: path.join(OUT, 'gaps-habits-desktop.png'), fullPage: true });

/* ---- Notifications: weekly review + budget alerts ----------------------- */
await page.goto(`${BASE}#/notifications`, { waitUntil: 'networkidle' });
await page.waitForSelector('.notif-page');
const budgetBefore = await page.locator('.notif-row[data-type="budget"]').count();
await page.locator('[data-action="check"]').first().click();
await page.waitForTimeout(1400);
const budgetAfter = await page.locator('.notif-row[data-type="budget"]').count();
const reviewNudge = await page
  .locator('.notif-row', { hasText: 'Your weekly review is ready' })
  .count();
const notifText = await page.locator('.notif-list').first().textContent();
console.log('notifications:', { budgetBefore, budgetAfter, reviewNudge });
await page.screenshot({ path: path.join(OUT, 'gaps-notifications-desktop.png'), fullPage: true });

/* ---- Phone view --------------------------------------------------------- */
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${BASE}#/settings`, { waitUntil: 'networkidle' });
await page.waitForSelector('[data-notify-toggle]');
await page.locator('[data-remind-form]').scrollIntoViewIfNeeded();
await page.screenshot({ path: path.join(OUT, 'gaps-settings-phone.png'), fullPage: true });

console.log(
  'assertions:',
  JSON.stringify(
    {
      fourNudges: nudgeCount === 4,
      leadSaved: leadAfter === '5',
      togglesWork: toggledOff && toggledOn,
      scoreChipsVisible: scoreChips > 0,
      historyRecorded: historyLines.some((line) => /Marked done/i.test(line)),
      puffyOrderDescending: sortedDesc,
      scorePanelVisible: scorePanel > 0,
      planScoresVisible: planScores > 0,
      billReminderSaved: billReminderOk,
      streaksSettled,
      reviewNudgeCreated: reviewNudge > 0,
      budgetAlertCreated: budgetAfter > budgetBefore,
      notificationText: notifText ? 'rendered' : 'empty',
    },
    null,
    2
  )
);
console.log('errors:', errors.length ? errors : 'none');

await browser.close();
