import {
  getMoneyOverview,
  saveTransaction,
  deleteTransaction,
  saveBudget,
  deleteBudget,
} from '../api.js';
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  categoryMeta,
} from '../constants.js';
import {
  addDays,
  esc,
  formatDate,
  money,
  monthLabel,
  monthKey,
  monthRange,
  shiftMonth,
  todayISO,
} from '../ui/format.js';
import { pageHead } from '../ui/widgets.js';
import { icon } from '../icons.js';
import { openSheet, confirmSheet } from '../ui/sheet.js';
import { toast, toastError } from '../ui/toast.js';
import { pip } from '../mascot.js';
import { onThemeChange } from '../theme.js';
import {
  loadChartJS,
  drawCategoryChart,
  drawTrendChart,
  drawBudgetChart,
  chartTheme,
  toneColor,
  budgetColor,
} from '../ui/charts.js';

const CURRENT = monthKey();
const isCurrentMonth = () => state.month === CURRENT;

let state = {
  month: CURRENT,
  overview: null,
  filter: 'all',
};
let charts = [];
let chartToken = 0;
let loadToken = 0;
let rootEl = null;
let unsubTheme = null;

const levelFor = (percent) => (percent >= 100 ? 'over' : percent >= 80 ? 'warn' : 'ok');
const toneFor = (percent) => (percent >= 100 ? 'danger' : percent >= 80 ? 'ochre' : 'sage');

/* Overview keeps expenses and income apart for the charts; the ledger wants
   one stream, newest first. */
const allTransactions = (overview = {}) =>
  [...(overview.expenses || []), ...(overview.income || [])].sort((a, b) =>
    (a.date || '') < (b.date || '') ? 1 : -1
  );

function flatCategories() {
  return EXPENSE_CATEGORIES;
}

function categoryOrder(id) {
  const index = flatCategories().findIndex((c) => c.id === id);
  return index === -1 ? 99 : index;
}

function monthParts(key) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  return {
    month: d.toLocaleDateString('en-US', { month: 'long' }),
    short: d.toLocaleDateString('en-US', { month: 'short' }),
    year: String(y),
  };
}

export default async function moneyPage(root, ctx) {
  rootEl = root;
  state = { month: monthKey(), overview: null, filter: 'all' };
  charts = [];

  root.innerHTML = `<div class="page money-page">
    <div class="page-loading" aria-busy="true">
      <div class="skeleton page-loading__head"></div>
      <div class="skeleton page-loading__ledger"></div>
      <div class="skeleton page-loading__chart"></div>
      <span class="sr-only">Loading this month</span>
    </div>
  </div>`;

  unsubTheme = onThemeChange(() => {
    if (state.overview) drawCharts();
  });

  async function loadMonth() {
    const token = ++loadToken;
    root.setAttribute('aria-busy', 'true');
    try {
      const overview = await getMoneyOverview(state.month);
      if (token !== loadToken) return;
      state.overview = overview;
      paint();
      drawCharts();
    } catch (err) {
      console.error(err);
      root.innerHTML = `<div class="page"><div class="card card--pad-lg">
        <span class="eyebrow">Where it goes</span>
        <h2 style="margin:10px 0 8px">This month didn’t load.</h2>
        <p class="muted small">The local ledger could not be read. Nothing has been lost — try reloading.</p>
        <button class="btn btn--primary" type="button" style="margin-top:16px" data-reload>Reload the page</button>
      </div></div>`;
      root.querySelector('[data-reload]')?.addEventListener('click', () => window.location.reload());
    } finally {
      root.setAttribute('aria-busy', 'false');
    }
  }

  function ledger(overview) {
    const { totals, rows, income } = overview;
    const net = totals.net;
    const risky = rows.filter((r) => r.percent >= 80);
    const over = rows.filter((r) => r.percent >= 100);
    return `<section class="ledger money-ledger" aria-label="Month summary">
      <div class="ledger-cell" data-ledger-cell="accent">
        <span class="ledger-cell__label"><span class="pill-dot"></span>Spent</span>
        <strong class="ledger-cell__value">${money(totals.spent, { cents: false })}</strong>
        <span class="ledger-cell__note">${
          totals.budget ? `of ${money(totals.budget, { cents: false })} budgeted` : 'no budgets set yet'
        }</span>
      </div>
      <div class="ledger-cell" data-ledger-cell="sage">
        <span class="ledger-cell__label"><span class="pill-dot"></span>Income</span>
        <strong class="ledger-cell__value">${money(totals.income, { cents: false })}</strong>
        <span class="ledger-cell__note">${income.length} deposit${income.length === 1 ? '' : 's'} this month</span>
      </div>
      <div class="ledger-cell" data-ledger-cell="${net < 0 ? 'danger' : 'ochre'}">
        <span class="ledger-cell__label"><span class="pill-dot"></span>Net</span>
        <strong class="ledger-cell__value">${net < 0 ? '−' : ''}${money(Math.abs(net), { cents: false })}</strong>
        <span class="ledger-cell__note">${net < 0 ? 'more out than in' : 'left after spending'}</span>
      </div>
      <div class="ledger-cell" data-ledger-cell="${over.length ? 'danger' : risky.length ? 'ochre' : 'sage'}">
        <span class="ledger-cell__label"><span class="pill-dot"></span>Budget used</span>
        <strong class="ledger-cell__value">${totals.percent}%</strong>
        <span class="ledger-cell__note">${
          over.length
            ? `${over.length} over · ${risky.length ? `${risky.length} need a look` : 'no lecture'}`
            : risky.length
              ? `${risky.length} close to the line`
              : rows.length
                ? 'all categories breathing'
                : 'add a budget to begin'
        }</span>
      </div>
    </section>`;
  }

  function categoryData(overview) {
    const entries = Object.entries(overview.spentByCategory || {})
      .map(([id, value]) => {
        const cat = categoryMeta(id);
        return {
          id,
          label: cat.label,
          tone: cat.tone,
          value: Math.round(Number(value) * 100) / 100,
        };
      })
      .filter((e) => e.value > 0)
      .sort((a, b) => b.value - a.value);
    if (entries.length <= 7) return entries;
    const head = entries.slice(0, 6);
    const rest = entries.slice(6).reduce((sum, e) => sum + e.value, 0);
    head.push({ id: 'other-mixed', label: 'Everything else', tone: 'muted', value: Math.round(rest * 100) / 100 });
    return head;
  }

  function trendData(overview) {
    const { days, start } = monthRange(state.month);
    const byDay = new Map();
    for (let i = 1; i <= days; i += 1) {
      const key = `${state.month}-${String(i).padStart(2, '0')}`;
      byDay.set(key, 0);
    }
    (overview.expenses || []).forEach((t) => {
      if (byDay.has(t.date)) byDay.set(t.date, byDay.get(t.date) + Number(t.amount || 0));
    });
    const dates = [...byDay.keys()];
    const values = [...byDay.values()].map((v) => Math.round(v * 100) / 100);
    const today = todayISO();
    const todayIndex = dates.findIndex((d) => d === today);
    const peakIndex = values.reduce((best, v, i) => (v > values[best] ? i : best), 0);
    return {
      labels: dates.map((d) => String(Number(d.slice(-2)))),
      dates,
      start,
      values,
      todayIndex: state.month === CURRENT ? todayIndex : -1,
      peak: values[peakIndex] > 0 ? { date: dates[peakIndex], value: values[peakIndex] } : null,
    };
  }

  function chartCardCategory(overview, data) {
    const total = data.reduce((sum, d) => sum + d.value, 0);
    return `<section class="card chart-card">
      <div class="card-head">
        <div>
          <span class="card-kicker">By category</span>
          <h2>Where it went</h2>
          <p class="card-head__sub">${monthLabel(state.month)}</p>
        </div>
        <span class="chart-total">${money(total, { cents: false })}</span>
      </div>
      ${
        total
          ? `<div class="chart-donut">
              <div class="chart-box" style="--chart-h:178px">
                <canvas data-chart="category" aria-hidden="true"></canvas>
                <div class="chart-fallback" hidden>${icon('chart', 18)} Charts need a connection the first time.</div>
              </div>
              <div class="donut-center" aria-hidden="true">
                <span>spent</span>
                <strong>${money(total, { cents: false })}</strong>
              </div>
            </div>
            <ul class="chart-legend" aria-label="Spending by category">
              ${data
                .map(
                  (d) => `<li>
                    <span class="legend-dot tone--${d.tone}" aria-hidden="true"></span>
                    <span class="legend-label">${d.label}</span>
                    <span class="legend-value">${money(d.value, { cents: false })}</span>
                  </li>`
                )
                .join('')}
            </ul>`
          : `<div class="chart-empty">${icon('chart', 20)}<p>No spending yet this month. The ledger is ready when you are.</p></div>`
      }
    </section>`;
  }

  function chartCardTrend(trend) {
    return `<section class="card chart-card chart-card--wide">
      <div class="card-head">
        <div>
          <span class="card-kicker">Daily rhythm</span>
          <h2>The shape of the month</h2>
          <p class="card-head__sub">Each bar is one day. Today is in terracotta.</p>
        </div>
        <span class="chart-total">${money(trend.values.reduce((s, v) => s + v, 0), { cents: false })}</span>
      </div>
      <div class="chart-box" data-loading style="--chart-h:178px">
        <canvas data-chart="trend" aria-hidden="true"></canvas>
        <div class="chart-fallback" hidden>${icon('chart', 18)} Charts need a connection the first time.</div>
      </div>
      <p class="chart-foot">${
        trend.peak
          ? `Busiest day: ${formatDate(trend.peak.date, 'short')} · ${money(trend.peak.value)}`
          : 'A quiet month so far. Nothing to prove.'
      }</p>
    </section>`;
  }

  function budgetRows(overview) {
    return overview.rows.slice().sort((a, b) => categoryOrder(a.category) - categoryOrder(b.category));
  }

  function budgetCard(overview) {
    const rows = budgetRows(overview);
    const canAdd = EXPENSE_CATEGORIES.some((c) => !rows.some((r) => r.category === c.id));
    return `<section class="card budgets-card" aria-labelledby="budgets-title">
      <div class="card-head">
        <div>
          <span class="card-kicker">The limits</span>
          <h2 id="budgets-title">Budgets</h2>
          <p class="card-head__sub">Amber at 80%, rust at 100%. No lecture attached.</p>
        </div>
        ${
          canAdd
            ? `<button class="btn btn--sm btn--secondary" type="button" data-action="add-budget">
                ${icon('plus', 14)} Set
              </button>`
            : '<span class="tiny muted">Every category set</span>'
        }
      </div>
      ${
        rows.length
          ? `<ul class="budget-list">
              ${rows
                .map((row) => {
                  const level = levelFor(row.percent);
                  const tone = toneFor(row.percent);
                  return `<li class="budget-row" data-category="${row.category}">
                    <div class="budget-row__top">
                      <span class="budget-cat">
                        <span class="legend-dot tone--${categoryMeta(row.category).tone}" aria-hidden="true"></span>
                        ${row.label}
                      </span>
                      <span class="budget-amount">${money(row.spent, { cents: false })} <span>of ${money(row.limit, { cents: false })}</span></span>
                    </div>
                    <div class="bar" role="progressbar" aria-label="${row.label} budget used"
                      aria-valuenow="${Math.min(999, row.percent)}" aria-valuemin="0" aria-valuemax="100">
                      <div class="bar__fill" data-level="${level === 'ok' ? '' : level}" style="--p:${Math.min(100, row.percent)}"></div>
                    </div>
                    <div class="budget-row__foot">
                      <span class="budget-left ${level === 'over' ? 'is-over' : ''}">${
                        row.remaining >= 0 ? `${money(row.remaining)} left` : `${money(Math.abs(row.remaining))} over`
                      }</span>
                      <span class="tag tag--${tone}">${row.percent > 999 ? '999%+' : `${row.percent}%`}</span>
                      <button class="icon-btn budget-edit" type="button" data-action="edit-budget"
                        data-category="${row.category}" aria-label="Edit ${row.label} budget">
                        ${icon('edit', 14)}
                      </button>
                    </div>
                  </li>`;
                })
                .join('')}
            </ul>`
          : `<div class="mini-empty">
              ${icon('target', 22)}
              <p>No budgets for ${monthLabel(state.month)}. Set one and the bar will keep an honest score.</p>
              <button class="btn btn--sm btn--accent-soft" type="button" data-action="add-budget">Set a first budget</button>
            </div>`
      }
    </section>`;
  }

  function budgetChartCard(overview) {
    const rows = budgetRows(overview);
    if (!rows.length) return '';
    return `<section class="card chart-card chart-card--rail">
      <div class="card-head">
        <div>
          <span class="card-kicker">Budget vs actual</span>
          <h2>The gap</h2>
        </div>
        <div class="chart-key" aria-hidden="true">
          <span><i class="legend-dot tone--muted"></i>Budget</span>
          <span><i class="legend-dot tone--accent"></i>Spent</span>
        </div>
      </div>
      <div class="chart-box" data-loading style="--chart-h:${Math.max(200, rows.length * 26)}px">
        <canvas data-chart="budget" aria-hidden="true"></canvas>
        <div class="chart-fallback" hidden>${icon('chart', 18)} Charts need a connection the first time.</div>
      </div>
    </section>`;
  }

  function transactionRow(t) {
    const cat = categoryMeta(t.category);
    const income = t.type === 'income';
    return `<li class="tx-row" data-id="${t.id}" data-type="${t.type}">
      <span class="tx-icon tone--${cat.tone}" aria-hidden="true">${icon(cat.icon, 16)}</span>
      <div class="tx-body">
        <p class="tx-note">${esc(t.note || cat.label)}</p>
        <p class="tx-meta">${cat.label}${t.billId ? ' · Bill payment' : ''}</p>
      </div>
      <span class="tx-amount ${income ? 'is-income' : ''}">${income ? '+' : '−'}${money(t.amount)}</span>
      <details class="row-menu">
        <summary class="icon-btn tx-more" aria-label="More options for ${esc(t.note || cat.label)}">${icon('more', 16)}</summary>
        <div class="menu menu--right">
          <button type="button" data-action="edit-tx">${icon('edit', 15)} Edit</button>
          <button type="button" class="menu__danger" data-action="delete-tx">${icon('trash', 15)} Delete</button>
        </div>
      </details>
    </li>`;
  }

  function transactionGroups(overview) {
    const items = allTransactions(overview).filter(
      (t) => state.filter === 'all' || t.type === state.filter
    );
    if (!items.length) {
      return `<div class="tx-empty">
        ${pip({ mood: 'thinking', size: 84 })}
        <p>Nothing here for ${monthLabel(state.month, { long: false })} yet. Add an expense and the month starts telling the truth.</p>
        <button class="btn btn--sm btn--accent-soft" type="button" data-action="add-expense">${icon('plus', 14)} Add an expense</button>
      </div>`;
    }
    const byDate = new Map();
    items.forEach((t) => {
      if (!byDate.has(t.date)) byDate.set(t.date, []);
      byDate.get(t.date).push(t);
    });
    return [...byDate.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([date, list]) => {
        const net = list.reduce((sum, t) => sum + (t.type === 'income' ? Number(t.amount) : -Number(t.amount)), 0);
        return `<div class="tx-day">
          <div class="tx-day__head">
            <h3>${date === todayISO() ? 'Today' : formatDate(date, 'long')}</h3>
            <span class="tx-day__sum ${net > 0 ? 'is-income' : ''}">${net > 0 ? '+' : net < 0 ? '−' : ''}${money(Math.abs(net))}</span>
          </div>
          <ul class="tx-list">${list.map(transactionRow).join('')}</ul>
        </div>`;
      })
      .join('');
  }

  function transactionCard(overview) {
    const all = allTransactions(overview);
    const counts = {
      all: all.length,
      expense: all.filter((t) => t.type === 'expense').length,
      income: all.filter((t) => t.type === 'income').length,
    };
    return `<section class="card tx-card" data-tx-card aria-labelledby="tx-title">
      <div class="card-head tx-card__head">
        <div>
          <span class="card-kicker">The ledger</span>
          <h2 id="tx-title">Every entry</h2>
        </div>
        <div class="segmented" role="group" aria-label="Filter transactions">
          <button type="button" data-filter="all" aria-pressed="${state.filter === 'all'}">All <span class="seg-count">${counts.all}</span></button>
          <button type="button" data-filter="expense" aria-pressed="${state.filter === 'expense'}">Expenses <span class="seg-count">${counts.expense}</span></button>
          <button type="button" data-filter="income" aria-pressed="${state.filter === 'income'}">Income <span class="seg-count">${counts.income}</span></button>
        </div>
      </div>
      <div class="tx-groups">${transactionGroups(overview)}</div>
    </section>`;
  }

  function rail(overview) {
    const rows = budgetRows(overview);
    const closest = rows.slice().sort((a, b) => b.percent - a.percent)[0];
    const over = rows.filter((r) => r.percent >= 100);
    return `<aside class="money-rail" aria-label="Budgets and notes">
      ${budgetCard(overview)}
      ${budgetChartCard(overview)}
      <section class="rail-card card rail-card--pip">
        ${pip({ mood: over.length ? 'thinking' : 'happy', size: 60 })}
        <div>
          <span class="card-kicker">Pip says</span>
          <p class="rail-pip">${
            over.length
              ? `${over.length === 1 ? 'One category is' : `${over.length} categories are`} over. No lecture — move a number, or let this month be a lesson.`
              : closest
                ? `${esc(closest.label)} is closest to its limit at ${closest.percent}%. Still room to breathe.`
                : 'A budget is a guess you can revise. Nothing here is a verdict.'
          }</p>
        </div>
      </section>
    </aside>`;
  }

  function paint() {
    const overview = state.overview;
    if (!overview) return;
    const parts = monthParts(state.month);
    root.innerHTML = `<div class="page money-page">
      ${pageHead({
        eyebrow: 'Where it goes',
        title: 'The month, in plain sight.',
        sub: 'A ledger without judgement: every coffee counted, every budget honest. Switch months, nothing is lost.',
        actions: `<div class="money-actions">
          <div class="month-nav" role="group" aria-label="Choose a month">
            <button class="icon-btn" type="button" data-action="prev-month" aria-label="Previous month">${icon('chevron-left', 17)}</button>
            <span class="month-nav__label" aria-live="polite">
              <strong>${parts.month}</strong>
              <span>${parts.year}</span>
            </span>
            <button class="icon-btn" type="button" data-action="next-month" aria-label="Next month" ${isCurrentMonth() ? 'disabled' : ''}>${icon('chevron-right', 17)}</button>
          </div>
          ${isCurrentMonth() ? '' : '<button class="chip" type="button" data-action="this-month">This month</button>'}
          <button class="btn btn--ghost money-add-income" type="button" data-action="add-income">${icon('arrow-down', 15)} Income</button>
          <button class="btn btn--primary" type="button" data-action="add-expense">${icon('plus', 16)} Add expense</button>
        </div>`,
      })}
      ${ledger(overview)}
      <div class="money-charts">
        ${chartCardCategory(overview, categoryData(overview))}
        ${chartCardTrend(trendData(overview))}
      </div>
      <div class="money-layout">
        ${transactionCard(overview)}
        ${rail(overview)}
      </div>
    </div>`;
    root.querySelector('[data-action="next-month"]')?.toggleAttribute(
      'disabled',
      isCurrentMonth()
    );
  }

  function refreshTxCard() {
    const card = root.querySelector('[data-tx-card]');
    if (!card || !state.overview) return;
    card.outerHTML = transactionCard(state.overview);
  }

  function destroyCharts() {
    charts.forEach((chart) => {
      try {
        chart.destroy();
      } catch {
        /* already gone */
      }
    });
    charts = [];
  }

  async function drawCharts() {
    const overview = state.overview;
    if (!overview) return;
    const token = ++chartToken;
    destroyCharts();
    const period = state.month;
    try {
      await loadChartJS();
      if (token !== chartToken || state.month !== period || state.overview !== overview) return;
      root.querySelectorAll('.chart-box[data-loading]').forEach((el) => el.removeAttribute('data-loading'));
      const categoryCanvas = root.querySelector('[data-chart="category"]');
      const trendCanvas = root.querySelector('[data-chart="trend"]');
      const budgetCanvas = root.querySelector('[data-chart="budget"]');
      const theme = chartTheme();
      if (categoryCanvas) {
        const data = categoryData(overview).map((d) => ({ ...d, color: toneColor(d.tone, theme) }));
        charts.push(drawCategoryChart(categoryCanvas, data));
      }
      if (trendCanvas) {
        const trend = trendData(overview);
        charts.push(
          drawTrendChart(trendCanvas, {
            days: trend.labels,
            dates: trend.dates,
            values: trend.values,
            todayIndex: trend.todayIndex,
          })
        );
      }
      if (budgetCanvas) {
        charts.push(drawBudgetChart(budgetCanvas, budgetRows(overview)));
      }
    } catch {
      /* Charts are an enhancement. The numbers above and beside them stay. */
      root.querySelectorAll('.chart-box[data-loading]').forEach((el) => el.removeAttribute('data-loading'));
      root.querySelectorAll('.chart-fallback').forEach((el) => {
        el.hidden = false;
        el.previousElementSibling?.setAttribute('hidden', '');
      });
      root.querySelectorAll('.chart-donut .donut-center').forEach((el) => {
        el.hidden = true;
      });
    }
  }

  async function changeMonth(nextMonth) {
    if (nextMonth > CURRENT) return;
    if (nextMonth === state.month) return;
    closeMenus();
    state.month = nextMonth;
    state.filter = 'all';
    await loadMonth();
  }

  function closeMenus() {
    root.querySelectorAll('details[open]').forEach((d) => d.removeAttribute('open'));
  }

  function categoryOptions(type, selected) {
    const list = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    return list
      .map(
        (c) =>
          `<option value="${c.id}" ${c.id === selected ? 'selected' : ''}>${c.label}</option>`
      )
      .join('');
  }

  function openTxEditor(tx = null, type = 'expense') {
    const isEdit = Boolean(tx);
    let kind = tx?.type || type;
    const sheet = openSheet({
      eyebrow: isEdit ? 'Edit an entry' : kind === 'income' ? 'Money in' : 'Money out',
      title: isEdit ? 'Change an entry.' : kind === 'income' ? 'Add income.' : 'Add an expense.',
      subtitle: isEdit
        ? 'Fix a typo, change a category. The month recalculates itself.'
        : 'Small and honest beats perfect and vague.',
      body: `<form id="tx-form" novalidate>
        <div class="segmented tx-type" role="group" aria-label="Transaction type">
          <button type="button" data-tx-type="expense" aria-pressed="${kind === 'expense'}">Expense</button>
          <button type="button" data-tx-type="income" aria-pressed="${kind === 'income'}">Income</button>
        </div>
        <div class="field-row" style="margin-top:14px">
          <div class="field">
            <label for="tx-amount">Amount</label>
            <div class="input-group">
              <input class="input" id="tx-amount" name="amount" type="number" inputmode="decimal"
                min="0.01" step="0.01" required value="${tx ? Number(tx.amount).toFixed(2) : ''}" placeholder="0.00">
              <span class="input-group__suffix">USD</span>
            </div>
          </div>
          <div class="field">
            <label for="tx-date">Date</label>
            <input class="input" id="tx-date" name="date" type="date" required value="${tx?.date || todayISO()}" max="${todayISO()}">
          </div>
        </div>
        <div class="field" style="margin-top:14px">
          <label for="tx-category">Category</label>
          <div class="select-wrap">
            <select class="select" id="tx-category" name="category">
              ${categoryOptions(kind, tx?.category)}
            </select>
            ${icon('chevron-down', 15)}
          </div>
        </div>
        <div class="field" style="margin-top:14px">
          <label for="tx-note">Note <span class="field__hint" style="font-weight:400">(optional)</span></label>
          <input class="input" id="tx-note" name="note" maxlength="90"
            value="${esc(tx?.note || '')}" placeholder="e.g. Coffee at the library" autocomplete="off">
        </div>
      </form>`,
      footer: `
        ${isEdit ? `<button class="btn btn--danger" type="button" data-delete>${icon('trash', 15)} Delete</button>` : ''}
        <button class="btn btn--ghost" type="button" data-cancel>Cancel</button>
        <button class="btn btn--primary" type="button" data-save>${isEdit ? 'Save changes' : 'Add entry'}</button>`,
      initialFocus: '#tx-amount',
    });

    const form = sheet.dialog.querySelector('#tx-form');
    const catSelect = sheet.dialog.querySelector('#tx-category');
    const typeButtons = [...sheet.dialog.querySelectorAll('[data-tx-type]')];

    const setType = (next) => {
      kind = next;
      typeButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.txType === next)));
      catSelect.innerHTML = categoryOptions(next, null);
      const eyebrow = sheet.dialog.querySelector('.eyebrow');
      if (eyebrow) eyebrow.textContent = next === 'income' ? 'Money in' : 'Money out';
    };
    typeButtons.forEach((b) =>
      b.addEventListener('click', () => {
        if (!isEdit) setType(b.dataset.txType);
      })
    );
    if (isEdit) typeButtons.forEach((b) => b.toggleAttribute('disabled', true));

    sheet.dialog.querySelector('[data-cancel]').addEventListener('click', sheet.close);
    sheet.dialog.querySelector('[data-save]').addEventListener('click', () => form.requestSubmit());
    sheet.dialog.querySelector('[data-delete]')?.addEventListener('click', async () => {
      sheet.close();
      const ok = await confirmSheet({
        title: 'Delete this entry?',
        message: 'The amount comes out of this month’s totals. Nothing else changes.',
        confirmLabel: 'Delete entry',
      });
      if (!ok) return;
      await deleteTransaction(tx.id);
      toast('Entry removed');
      await loadMonth();
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const amount = Number(data.get('amount'));
      if (!Number.isFinite(amount) || amount <= 0) {
        toastError('Add an amount greater than zero');
        sheet.dialog.querySelector('#tx-amount').focus();
        return;
      }
      try {
        const saved = await saveTransaction({
          id: tx?.id,
          type: kind,
          category: String(data.get('category') || (kind === 'income' ? 'other-income' : 'other')),
          amount,
          date: String(data.get('date') || todayISO()),
          note: String(data.get('note') || '').trim(),
          billId: tx?.billId || null,
        });
        /* Back-dating an entry should not make it vanish from view. */
        const savedMonth = (saved.date || '').slice(0, 7);
        if (savedMonth && savedMonth !== state.month && savedMonth <= CURRENT) {
          state.month = savedMonth;
          state.filter = 'all';
        }
        sheet.close();
        toast(isEdit ? 'Entry updated' : kind === 'income' ? 'Income added' : 'Expense added');
        await loadMonth();
      } catch (err) {
        console.error(err);
        toastError('That entry could not be saved');
      }
    });
  }

  function openBudgetEditor(category = '') {
    const overview = state.overview;
    if (!overview) return;
    const existing = overview.rows.find((r) => r.category === category);
    const used = new Set(overview.rows.map((r) => r.category));
    const options = EXPENSE_CATEGORIES.filter((c) => !used.has(c.id) || c.id === category);
    if (!options.length) {
      toast('Every category already has a budget this month', { type: 'info' });
      return;
    }
    const chosen = category || options[0].id;
    const sheet = openSheet({
      eyebrow: existing ? 'Adjust a limit' : 'A new limit',
      title: existing ? `Edit ${existing.label}.` : 'Set a budget.',
      subtitle: `For ${monthLabel(state.month)}. A limit is a guide, not a grade.`,
      body: `<form id="budget-form" novalidate>
        <div class="field">
          <label for="budget-category">Category</label>
          <div class="select-wrap">
            <select class="select" id="budget-category" name="category" ${existing ? 'disabled' : ''}>
              ${options
                .map(
                  (c) => `<option value="${c.id}" ${c.id === chosen ? 'selected' : ''}>${c.label}</option>`
                )
                .join('')}
            </select>
            ${icon('chevron-down', 15)}
          </div>
        </div>
        <div class="field" style="margin-top:14px">
          <label for="budget-limit">Monthly limit</label>
          <div class="input-group">
            <input class="input" id="budget-limit" name="limit" type="number" inputmode="decimal"
              min="1" step="1" required value="${existing ? Math.round(existing.limit) : ''}" placeholder="0">
            <span class="input-group__suffix">USD</span>
          </div>
          ${
            existing
              ? `<p class="field__hint">Spent so far: ${money(existing.spent)} · ${existing.percent}% of the current limit.</p>`
              : ''
          }
        </div>
      </form>`,
      footer: `
        ${existing ? `<button class="btn btn--danger" type="button" data-delete>${icon('trash', 15)} Remove</button>` : ''}
        <button class="btn btn--ghost" type="button" data-cancel>Cancel</button>
        <button class="btn btn--primary" type="button" data-save>${existing ? 'Save limit' : 'Set budget'}</button>`,
      initialFocus: '#budget-limit',
    });

    const form = sheet.dialog.querySelector('#budget-form');
    sheet.dialog.querySelector('[data-cancel]').addEventListener('click', sheet.close);
    sheet.dialog.querySelector('[data-save]').addEventListener('click', () => form.requestSubmit());
    sheet.dialog.querySelector('[data-delete]')?.addEventListener('click', async () => {
      sheet.close();
      const ok = await confirmSheet({
        title: 'Remove this budget?',
        message: `${existing.label} will stop tracking against a limit for ${monthLabel(state.month)}. Spending stays recorded.`,
        confirmLabel: 'Remove budget',
      });
      if (!ok) return;
      await deleteBudget(existing.id);
      toast('Budget removed');
      await loadMonth();
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const limit = Number(data.get('limit'));
      if (!Number.isFinite(limit) || limit <= 0) {
        toastError('Set a limit above zero');
        sheet.dialog.querySelector('#budget-limit').focus();
        return;
      }
      const cat = existing ? existing.category : String(data.get('category'));
      try {
        await saveBudget({ month: state.month, category: cat, limit });
        sheet.close();
        toast(existing ? 'Budget updated' : 'Budget set');
        await loadMonth();
      } catch (err) {
        console.error(err);
        toastError('That budget could not be saved');
      }
    });
  }

  async function onClick(event) {
    const filter = event.target.closest('[data-filter]');
    if (filter) {
      state.filter = filter.dataset.filter;
      refreshTxCard();
      return;
    }
    const actionEl = event.target.closest('[data-action]');
    if (!actionEl) return;
    const action = actionEl.dataset.action;
    if (!['add-expense', 'add-income'].includes(action)) closeMenus();

    if (action === 'prev-month') return changeMonth(shiftMonth(state.month, -1));
    if (action === 'next-month') return changeMonth(shiftMonth(state.month, 1));
    if (action === 'this-month') return changeMonth(CURRENT);
    if (action === 'add-expense') return openTxEditor(null, 'expense');
    if (action === 'add-income') return openTxEditor(null, 'income');
    if (action === 'add-budget') return openBudgetEditor();
    if (action === 'edit-budget') return openBudgetEditor(actionEl.dataset.category);

    const row = actionEl.closest('[data-id]');
    const tx = row && state.overview
      ? allTransactions(state.overview).find((t) => t.id === row.dataset.id)
      : null;
    if (!tx) return;
    if (action === 'edit-tx') openTxEditor(tx);
    else if (action === 'delete-tx') {
      const ok = await confirmSheet({
        title: 'Delete this entry?',
        message: 'The amount comes out of this month’s totals. Nothing else changes.',
        confirmLabel: 'Delete entry',
      });
      if (!ok) return;
      await deleteTransaction(tx.id);
      toast('Entry removed');
      await loadMonth();
    }
  }

  root.addEventListener('click', onClick);
  await loadMonth();

  return {
    destroy() {
      root.removeEventListener('click', onClick);
      unsubTheme?.();
      unsubTheme = null;
      loadToken += 1;
      chartToken += 1;
      destroyCharts();
    },
  };
}
