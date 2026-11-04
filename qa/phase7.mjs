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

const localISO = (page) =>
  page.evaluate(() => {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  });

for (const [label, viewport] of sizes) {
  for (const theme of ['light', 'dark']) {
    const { context, page } = await newPage(viewport, theme);
    await seed(page);
    const today = await localISO(page);

    /* ---------------- Habits & goals ---------------- */
    await page.goto(`${base}#/habits`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.habits-page .habit-row');
    await page.waitForTimeout(650);
    await clearToasts(page);
    await page.screenshot({ path: `${out}/phase7-habits-${label}-${theme}.png`, fullPage: true });

    const habitsGlance = await page.evaluate(() => ({
      rows: document.querySelectorAll('.habit-row').length,
      days: document.querySelectorAll('.habit-day').length,
      doneDays: document.querySelectorAll('.habit-day[aria-pressed="true"]').length,
      todayMarks: document.querySelectorAll('.habit-day.is-today').length,
      goals: document.querySelectorAll('.goal-card').length,
      rings: document.querySelectorAll('.goal-card .ring__num').length,
      ledger: [...document.querySelectorAll('.habit-ledger .ledger-cell__value')].map((v) =>
        v.textContent.replace(/\s+/g, ' ').trim()
      ),
      rail: document.querySelectorAll('.habits-rail .rail-card').length,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
    }));
    notes.push(`[${label}/${theme}] habits: ${JSON.stringify(habitsGlance)}`);

    /* goal rings actually have a stroke offset */
    const ringState = await page.evaluate(() => {
      const c = document.querySelector('.goal-card .ring__value');
      return c
        ? { offset: c.getAttribute('stroke-dashoffset'), dash: c.getAttribute('stroke-dasharray') }
        : null;
    });
    notes.push(`[${label}/${theme}] goal ring ${JSON.stringify(ringState)}`);

    if (label === 'desktop' && theme === 'light') {
      // Toggle today's check-in for "Read before bed" (not kept today in seed)
      const readRow = page.locator('.habit-row', { hasText: 'Read before bed' });
      const readDay = readRow.locator(`.habit-day[data-date="${today}"]`);
      const beforePressed = await readDay.getAttribute('aria-pressed');
      await readDay.click();
      await page.waitForTimeout(500);
      const afterPressed = await page.locator(`.habit-row:has-text("Read before bed") .habit-day[data-date="${today}"]`).getAttribute('aria-pressed');
      const kept = await page.locator('.habit-ledger .ledger-cell__value').first().innerText();
      notes.push(`[desktop/light] habit today ${beforePressed}->${afterPressed}, kept today="${kept.replace(/\s+/g, ' ')}"`);
      const focused = await page.evaluate(() => document.activeElement?.dataset?.date || '');
      notes.push(`[desktop/light] focus restored to day=${focused === today}`);

      // Previous week view
      await page.click('.habit-board__nav [data-week="-1"]');
      await page.waitForTimeout(350);
      const prevTitle = await page.locator('#habit-board-title').innerText();
      const prevRange = await page.locator('.habit-board__range').innerText();
      await page.click('.habit-board__nav [data-week="1"]');
      await page.waitForTimeout(350);
      notes.push(`[desktop/light] week nav prev="${prevTitle}" (${prevRange}) back="${await page.locator('#habit-board-title').innerText()}"`);
      await clearToasts(page);

      // Add a habit
      await page.click('[data-action="add-habit"]');
      await page.waitForSelector('dialog.sheet[open] #habit-form');
      await page.fill('#habit-name', 'QA watering');
      await page.click('dialog.sheet[open] [data-icon="droplet"]');
      await page.fill('#habit-target', '2');
      await page.screenshot({ path: `${out}/phase7-habits-editor.png`, fullPage: true });
      await page.click('dialog.sheet[open] [data-save]');
      await page.waitForSelector('dialog.sheet', { state: 'detached' });
      await page.waitForTimeout(650);
      const addedHabit = page.locator('.habit-row', { hasText: 'QA watering' });
      const addedCount = await addedHabit.count();
      const addedMeta = addedCount ? (await addedHabit.locator('.habit-row__meta').innerText()).trim() : '';
      notes.push(`[desktop/light] add habit count=${addedCount} meta="${addedMeta}"`);

      // Edit target
      await addedHabit.locator('summary').first().click();
      await addedHabit.locator('[data-action="edit-habit"]').click();
      await page.waitForSelector('dialog.sheet[open] #habit-form');
      await page.fill('#habit-target', '3');
      await page.click('dialog.sheet[open] [data-save]');
      await page.waitForSelector('dialog.sheet', { state: 'detached' });
      await page.waitForTimeout(600);
      const editedMeta = (await page.locator('.habit-row', { hasText: 'QA watering' }).locator('.habit-row__meta').innerText()).trim();
      notes.push(`[desktop/light] edit habit meta="${editedMeta}"`);

      // Delete it
      const qaHabit = page.locator('.habit-row', { hasText: 'QA watering' });
      await qaHabit.locator('summary').first().click();
      await qaHabit.locator('[data-action="delete-habit"]').click();
      await page.waitForSelector('dialog.sheet[open] [data-ok]');
      await page.click('dialog.sheet[open] [data-ok]');
      await page.waitForSelector('dialog.sheet', { state: 'detached' });
      await page.waitForTimeout(600);
      notes.push(`[desktop/light] delete habit remaining=${await page.locator('.habit-row', { hasText: 'QA watering' }).count()}`);

      // Log goal progress: 7 -> 9 books
      const bookGoal = page.locator('.goal-card', { hasText: 'Read 12 books this year' });
      await bookGoal.locator('[data-action="log-goal"]').click();
      await page.waitForSelector('dialog.sheet[open] #progress-form');
      await page.click('dialog.sheet[open] [data-step]');
      await page.click('dialog.sheet[open] [data-step]');
      const progressValue = await page.inputValue('dialog.sheet[open] #progress-current');
      await page.click('dialog.sheet[open] [data-save]');
      await page.waitForSelector('dialog.sheet', { state: 'detached' });
      await page.waitForTimeout(700);
      const bookCardText = (await page.locator('.goal-card', { hasText: 'Read 12 books this year' }).innerText()).replace(/\s+/g, ' ');
      const bookRing = (await page.locator('.goal-card', { hasText: 'Read 12 books this year' }).locator('.ring__num').innerText()).trim();
      notes.push(`[desktop/light] goal progress input="${progressValue}" card="${bookCardText}" ring=${bookRing}`);

      // Add + delete a goal
      await page.click('[data-action="add-goal"]');
      await page.waitForSelector('dialog.sheet[open] #goal-form');
      await page.fill('#goal-title', 'QA finish line');
      await page.fill('#goal-target', '10');
      await page.screenshot({ path: `${out}/phase7-goal-editor.png`, fullPage: true });
      await page.click('dialog.sheet[open] [data-save]');
      await page.waitForSelector('dialog.sheet', { state: 'detached' });
      await page.waitForTimeout(600);
      const qaGoal = page.locator('.goal-card', { hasText: 'QA finish line' });
      notes.push(`[desktop/light] add goal count=${await qaGoal.count()}`);
      await qaGoal.locator('summary').first().click();
      await qaGoal.locator('[data-action="delete-goal"]').click();
      await page.waitForSelector('dialog.sheet[open] [data-ok]');
      await page.click('dialog.sheet[open] [data-ok]');
      await page.waitForSelector('dialog.sheet', { state: 'detached' });
      await page.waitForTimeout(600);
      notes.push(`[desktop/light] delete goal remaining=${await page.locator('.goal-card', { hasText: 'QA finish line' }).count()}`);

      await clearToasts(page);
      await page.screenshot({ path: `${out}/phase7-habits-after.png`, fullPage: true });
    }

    /* ---------------- Weekly review ---------------- */
    await page.goto(`${base}#/review`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.review-page .review-summary');
    await page.waitForTimeout(650);
    await clearToasts(page);
    await page.screenshot({ path: `${out}/phase7-review-${label}-${theme}.png`, fullPage: true });

    const reviewGlance = await page.evaluate(() => ({
      ledger: [...document.querySelectorAll('.review-ledger .ledger-cell__value')].map((v) =>
        v.textContent.replace(/\s+/g, ' ').trim()
      ),
      summary: document.querySelector('.review-summary__line')?.textContent?.trim().slice(0, 90),
      done: document.querySelectorAll('.review-done li').length,
      cats: document.querySelectorAll('.review-cats li').length,
      habits: document.querySelectorAll('.review-habits li').length,
      goals: document.querySelectorAll('.review-goals li').length,
      suggestions: document.querySelectorAll('.review-notes li').length,
      moodDays: document.querySelectorAll('.mood-strip__day.is-logged').length,
      rail: document.querySelectorAll('.review-rail .rail-card').length,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
    }));
    notes.push(`[${label}/${theme}] review: ${JSON.stringify(reviewGlance)}`);

    if (label === 'desktop' && theme === 'light') {
      const labelBefore = (await page.locator('.review-nav .month-nav__label').innerText()).trim();
      await page.click('.review-nav [data-week="-1"]');
      await page.waitForTimeout(700);
      const labelPrev = (await page.locator('.review-nav .month-nav__label').innerText()).trim();
      const prevEnabled = await page.locator('.review-nav [data-week="1"]').isEnabled();
      const resetVisible = await page.locator('[data-week-reset]').count();
      notes.push(`[desktop/light] review nav "${labelBefore}" -> "${labelPrev}", nextEnabled=${prevEnabled}, resetChip=${resetVisible}`);
      await page.screenshot({ path: `${out}/phase7-review-prev.png`, fullPage: true });
      if (resetVisible) {
        await page.click('[data-week-reset]');
        await page.waitForTimeout(700);
      }
      notes.push(`[desktop/light] review reset label="${(await page.locator('.review-nav .month-nav__label').innerText()).trim()}"`);
      await clearToasts(page);
    }

    /* ---------------- Notifications ---------------- */
    await page.goto(`${base}#/notifications`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.notif-page .notif-row');
    await page.waitForTimeout(500);
    await clearToasts(page);
    await page.screenshot({ path: `${out}/phase7-notifications-${label}-${theme}.png`, fullPage: true });

    const notifGlance = await page.evaluate(() => ({
      rows: document.querySelectorAll('.notif-row').length,
      unread: document.querySelectorAll('.notif-row:not(.is-read)').length,
      groups: [...document.querySelectorAll('.notif-group__head h2')].map((h) => h.textContent.replace(/\s+/g, ' ').trim()),
      filters: [...document.querySelectorAll('.notif-toolbar [data-filter]')].map((b) => b.textContent.replace(/\s+/g, ' ').trim()),
      rail: document.querySelectorAll('.notif-rail .rail-card').length,
      permission: document.querySelector('.notif-permission__status')?.textContent?.trim(),
      toggleDisabled: document.querySelector('[data-notif-toggle]')?.disabled,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
    }));
    notes.push(`[${label}/${theme}] notifications: ${JSON.stringify(notifGlance)}`);

    if (label === 'desktop' && theme === 'light') {
      const unreadBefore = await page.locator('.notif-row:not(.is-read)').count();

      // Mark a read item unread via the menu
      const readRow = page.locator('.notif-row.is-read').first();
      await readRow.locator('summary').first().click();
      await readRow.locator('[data-action="toggle-read"]').click();
      await page.waitForTimeout(600);
      const unreadAfterToggle = await page.locator('.notif-row:not(.is-read)').count();
      notes.push(`[desktop/light] mark unread ${unreadBefore}->${unreadAfterToggle}`);

      // Delete it
      const unreadRow = page.locator('.notif-row:not(.is-read)').first();
      const deleteId = await unreadRow.getAttribute('data-id');
      const deleteTitle = (await unreadRow.locator('.notif-title').innerText()).replace(/\s+/g, ' ').trim();
      await unreadRow.locator('summary').first().click();
      await unreadRow.locator('[data-action="delete"]').click();
      await page.waitForTimeout(600);
      notes.push(`[desktop/light] delete "${deleteTitle}" remaining=${await page.locator(`.notif-row[data-id="${deleteId}"]`).count()}`);

      // Unread filter
      await page.click('.notif-toolbar [data-filter="unread"]');
      await page.waitForTimeout(300);
      const filteredRows = await page.locator('.notif-row').count();
      notes.push(`[desktop/light] unread filter rows=${filteredRows}`);
      await page.click('.notif-toolbar [data-filter="all"]');
      await page.waitForTimeout(300);

      // Mark all read
      await page.click('.notif-page .page-head__actions [data-action="mark-all"]');
      await page.waitForTimeout(800);
      const unreadNow = await page.locator('.notif-row:not(.is-read)').count();
      const markAllDisabled = await page.locator('.notif-page .page-head__actions [data-action="mark-all"]').isDisabled();
      notes.push(`[desktop/light] mark all read unread=${unreadNow}, disabled=${markAllDisabled}`);

      // Empty unread state
      await page.click('.notif-toolbar [data-filter="unread"]');
      await page.waitForTimeout(300);
      const emptyTitle = await page.locator('.notif-main .empty h3').innerText();
      notes.push(`[desktop/light] unread empty="${emptyTitle}"`);
      await page.screenshot({ path: `${out}/phase7-notifications-empty.png`, fullPage: true });
      await page.click('[data-filter-reset]');
      await page.waitForTimeout(300);

      // Reminder check
      await page.click('.notif-page .page-head__actions [data-action="check"]');
      await page.waitForTimeout(900);
      const toastText = await page.locator('.toast-region .toast').last().innerText().catch(() => '');
      notes.push(`[desktop/light] check reminders toast="${toastText.replace(/\n/g, ' ')}", rows=${await page.locator('.notif-row').count()}`);
      await clearToasts(page);
      await page.screenshot({ path: `${out}/phase7-notifications-after.png`, fullPage: true });
    }

    await context.close();
  }
}

await browser.close();

fs.writeFileSync(`${out}/phase7-notes.txt`, notes.join('\n') + '\n\nPROBLEMS:\n' + (problems.join('\n') || 'none') + '\n');
console.log(notes.slice(-8).join('\n'));
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'CLEAN: no console errors');
