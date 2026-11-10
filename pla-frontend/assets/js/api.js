/**
 * The only data boundary in the app.
 *
 * Every function is async. Pages never touch IndexedDB, localStorage records,
 * or fetch directly. When the JSP/Oracle backend arrives, each function below
 * becomes a small fetch() wrapper and no page needs to change.
 *
 * Records carry a client-generated UUID, updatedAt and synced flag; every
 * create/update/delete also lands in the syncQueue for later replay.
 */
import * as db from './store.js';
import { STORES } from './store.js';
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  categoryMeta,
  priorityMeta,
} from './constants.js';
import {
  todayISO,
  addDays,
  monthKey,
  diffDays,
  formatDate,
  money,
  monthLabel,
  startOfWeek,
} from './ui/format.js';

const uuid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);

const stamp = () => new Date().toISOString();
const touch = (record) => ({ ...record, updatedAt: stamp(), synced: false });
const maxOrder = (tasks) => tasks.reduce((max, t) => Math.max(max, Number(t.order) || 0), 0);
const clampNumber = (value, min, max) =>
  Math.min(max, Math.max(min, Number(value) || 0));

const HISTORY_LIMIT = 40;
const subtaskSignature = (subtasks = []) =>
  (subtasks || [])
    .map((s) => (typeof s === 'string' ? s : `${s.title}:${s.done ? 1 : 0}`))
    .join('|');

/** One audit trail entry per field that actually changed (FR-20). */
function taskHistoryEntries(existing, next) {
  const ts = stamp();
  const entry = (type, text) => ({ id: uuid(), ts, type, text });
  if (!existing) {
    const entries = [entry('created', 'Added to the list')];
    if (next.done) entries.push(entry('completed', 'Marked done'));
    return entries.reverse();
  }
  const entries = [];
  if (existing.done !== next.done) {
    entries.push(entry(next.done ? 'completed' : 'reopened', next.done ? 'Marked done' : 'Reopened'));
  }
  if (existing.title !== next.title) entries.push(entry('title', 'Title changed'));
  if ((existing.due || null) !== (next.due || null)) {
    entries.push(
      entry(
        'due',
        next.due ? `Due date moved to ${formatDate(next.due, 'short')}` : 'Due date cleared'
      )
    );
  }
  if (existing.priority !== next.priority) {
    entries.push(entry('priority', `Priority set to ${priorityMeta(next.priority).label.toLowerCase()}`));
  }
  if (Number(existing.estimate) !== Number(next.estimate)) {
    entries.push(entry('estimate', `Estimate set to ${next.estimate} min`));
  }
  if (existing.category !== next.category) {
    entries.push(entry('category', `Moved to ${categoryMeta(next.category).label}`));
  }
  if ((existing.notes || '') !== (next.notes || '')) entries.push(entry('notes', 'Notes updated'));
  if (subtaskSignature(existing.subtasks) !== subtaskSignature(next.subtasks)) {
    entries.push(entry('subtasks', 'Checklist updated'));
  }
  return entries;
}

let ready = null;

async function recordSync(entity, op, payload) {
  const entry = {
    id: uuid(),
    entity,
    op,
    payload,
    ts: Date.now(),
  };
  await db.put(STORES.syncQueue, entry);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('pla:queued', { detail: { entity, op } }));
  }
  return entry;
}

async function seedAll({ keepOnboarding = false, currentProfile = null } = {}) {
  const { buildDemoData } = await import('../../seed/demo-data.js');
  const demo = buildDemoData();
  const stores = [
    STORES.tasks,
    STORES.bills,
    STORES.transactions,
    STORES.budgets,
    STORES.habits,
    STORES.goals,
    STORES.notifications,
    STORES.checkins,
    STORES.plans,
    STORES.syncQueue,
  ];
  await db.clearMany(stores);
  await Promise.all([
    db.putMany(STORES.tasks, demo.tasks),
    db.putMany(STORES.bills, demo.bills),
    db.putMany(STORES.transactions, demo.transactions),
    db.putMany(STORES.budgets, demo.budgets),
    db.putMany(STORES.habits, demo.habits),
    db.putMany(STORES.goals, demo.goals),
    db.putMany(STORES.notifications, demo.notifications),
    db.putMany(STORES.checkins, demo.checkins),
  ]);

  let profile = demo.profile;
  if (keepOnboarding) {
    profile = {
      ...profile,
      ...(currentProfile || {}),
      onboarded: true,
      updatedAt: stamp(),
    };
  }
  await db.put(STORES.profile, profile);
  await db.put(STORES.meta, { key: 'seededAt', value: stamp(), persona: demo.profile.name });
  return profile;
}

export async function initApi() {
  if (ready) return ready;
  ready = (async () => {
    await db.openDB();
    // A new visitor gets an empty database; demo data is only written when
    // they choose a desk, so the welcome screen stays light.
    return db.get(STORES.profile, 'me');
  })();
  try {
    return await ready;
  } catch (err) {
    ready = null;
    throw err;
  }
}

/* ============================== Profile ================================= */

// BACKEND: GET /api/profile
export async function getProfile() {
  await initApi();
  return db.get(STORES.profile, 'me');
}

// BACKEND: PUT /api/profile
export async function saveProfile(patch) {
  const current = (await getProfile()) || { id: 'me' };
  const profile = touch({ ...current, ...patch, id: 'me' });
  await db.put(STORES.profile, profile);
  await recordSync('profile', 'update', profile);
  return profile;
}

// BACKEND: POST /api/onboarding
export async function completeOnboarding(patch = {}) {
  await initApi();
  const current = await getProfile();
  if (!current) {
    // First run: fill the desk with the demo week before handing over.
    return seedAll({ keepOnboarding: true, currentProfile: { ...patch, id: 'me' } });
  }
  return saveProfile({ ...patch, onboarded: true });
}

// BACKEND: POST /api/demo/reset
export async function resetDemoData() {
  await initApi();
  const current = await getProfile();
  return seedAll({ keepOnboarding: true, currentProfile: current });
}

// BACKEND: GET /api/stats
export async function getDataStats() {
  await initApi();
  const stores = ['tasks', 'bills', 'transactions', 'habits', 'goals', 'notifications', 'checkins'];
  const lists = await Promise.all(stores.map((key) => db.getAll(STORES[key])));
  const stats = Object.fromEntries(stores.map((key, i) => [key, lists[i].length]));
  const tasks = lists[0];
  stats.tasksOpen = tasks.filter((t) => !t.done).length;
  stats.tasksDone = tasks.filter((t) => t.done).length;
  stats.total = lists.reduce((sum, list) => sum + list.length, 0);
  return stats;
}

// BACKEND: GET /api/export
export async function getExportData() {
  await initApi();
  const [profile, tasks, bills, transactions, habits, goals, checkins, notifications] =
    await Promise.all([
      getProfile(),
      db.getAll(STORES.tasks),
      db.getAll(STORES.bills),
      db.getAll(STORES.transactions),
      db.getAll(STORES.habits),
      db.getAll(STORES.goals),
      db.getAll(STORES.checkins),
      db.getAll(STORES.notifications),
    ]);
  return { profile, tasks, bills, transactions, habits, goals, checkins, notifications };
}

/* =============================== Tasks ================================== */

// BACKEND: GET /api/tasks
export async function getTasks({ includeDone = true } = {}) {
  await initApi();
  let tasks = await db.getAll(STORES.tasks);
  tasks.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (!a.done && (a.order ?? 0) !== (b.order ?? 0)) return (a.order ?? 0) - (b.order ?? 0);
    return (a.due || '9999') < (b.due || '9999') ? -1 : 1;
  });
  if (!includeDone) tasks = tasks.filter((t) => !t.done);
  return tasks;
}

// BACKEND: GET /api/tasks/:id
export async function getTask(id) {
  await initApi();
  return db.get(STORES.tasks, id);
}

// BACKEND: POST /api/tasks  (PUT /api/tasks/:id for existing)
export async function saveTask(input) {
  await initApi();
  const tasks = await getTasks();
  const existing = input.id ? await getTask(input.id) : null;
  const next = {
    id: input.id || uuid(),
    title: (input.title || 'Untitled task').trim(),
    notes: input.notes || '',
    category: input.category || 'personal',
    priority: input.priority || 'medium',
    due: input.due || null,
    estimate: Number(input.estimate) || 30,
    subtasks: (input.subtasks || []).map((s) =>
      typeof s === 'string'
        ? { id: uuid(), title: s, done: false }
        : s.id
          ? s
          : { ...s, id: uuid() }
    ),
    done: Boolean(input.done),
    completedAt: input.done ? input.completedAt || existing?.completedAt || stamp() : null,
    order: input.order ?? existing?.order ?? maxOrder(tasks) + 1,
    createdAt: existing?.createdAt || stamp(),
  };
  const history = [...taskHistoryEntries(existing, next), ...(existing?.history || [])].slice(
    0,
    HISTORY_LIMIT
  );
  const task = touch({ ...next, history });
  await db.put(STORES.tasks, task);
  await recordSync('task', existing ? 'update' : 'create', task);
  return task;
}

// BACKEND: DELETE /api/tasks/:id
export async function deleteTask(id) {
  await initApi();
  await db.remove(STORES.tasks, id);
  await recordSync('task', 'delete', { id });
}

// BACKEND: PATCH /api/tasks/:id
export async function toggleTask(id, done) {
  const task = await getTask(id);
  if (!task) throw new Error('Task not found');
  return saveTask({
    ...task,
    done: done ?? !task.done,
    completedAt: (done ?? !task.done) ? stamp() : null,
  });
}

// BACKEND: PUT /api/tasks/reorder
export async function reorderTasks(orderedIds = []) {
  await initApi();
  const tasks = await getTasks();
  const byId = new Map(tasks.map((t) => [t.id, t]));
  await Promise.all(
    orderedIds.map(async (id, index) => {
      const task = byId.get(id);
      if (!task) return;
      const next = touch({ ...task, order: index + 1 });
      await db.put(STORES.tasks, next);
    })
  );
  await recordSync('task', 'reorder', { ids: orderedIds });
}

/* =============================== Bills ================================== */

// BACKEND: GET /api/bills
export async function getBills() {
  await initApi();
  const bills = await db.getAll(STORES.bills);
  return bills.sort((a, b) => (a.nextDue || '') < (b.nextDue || '') ? -1 : 1);
}

// BACKEND: POST /api/bills  (PUT /api/bills/:id)
export async function saveBill(input) {
  await initApi();
  const [existing, profile] = await Promise.all([
    input.id ? db.get(STORES.bills, input.id) : null,
    getProfile(),
  ]);
  const bill = touch({
    id: input.id || uuid(),
    name: (input.name || 'New bill').trim(),
    kind: input.kind || 'custom',
    icon: input.icon || 'receipt',
    category: input.category || 'other',
    amount: Number(input.amount) || 0,
    frequency: input.frequency || 'monthly',
    nextDue: input.nextDue || todayISO(),
    remindDaysBefore: clampNumber(
      input.remindDaysBefore ?? existing?.remindDaysBefore ?? profile?.remindDaysBefore ?? 3,
      0,
      30
    ),
    notes: input.notes || '',
    payments: input.payments || existing?.payments || [],
    lastPaid: existing?.lastPaid || null,
    createdAt: existing?.createdAt || stamp(),
  });
  await db.put(STORES.bills, bill);
  await recordSync('bill', existing ? 'update' : 'create', bill);
  return bill;
}

// BACKEND: DELETE /api/bills/:id
export async function deleteBill(id) {
  await initApi();
  await db.remove(STORES.bills, id);
  await recordSync('bill', 'delete', { id });
}

// BACKEND: GET /api/bills/:id/payments
export async function getPayments(billId) {
  const bill = await getBills().then((list) => list.find((b) => b.id === billId));
  return (bill?.payments || []).slice().sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function advanceDue(dateISO, frequency) {
  const d = new Date(`${dateISO}T12:00:00`);
  if (frequency === 'weekly') {
    d.setDate(d.getDate() + 7);
  } else {
    const months = frequency === 'quarterly' ? 3 : frequency === 'yearly' ? 12 : 1;
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + months);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, last));
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// BACKEND: POST /api/bills/:id/payments
export async function markBillPaid(id, paidDate = todayISO()) {
  await initApi();
  const bill = await db.get(STORES.bills, id);
  if (!bill) throw new Error('Bill not found');

  const payment = { id: uuid(), date: paidDate, amount: bill.amount };
  let nextDue = bill.nextDue || paidDate;
  let guard = 0;
  do {
    nextDue = advanceDue(nextDue, bill.frequency);
    guard += 1;
  } while (nextDue <= paidDate && guard < 36);

  const updated = touch({
    ...bill,
    nextDue,
    lastPaid: paidDate,
    payments: [payment, ...(bill.payments || [])],
  });
  await db.put(STORES.bills, updated);
  await recordSync('bill', 'update', updated);

  const transaction = touch({
    id: uuid(),
    type: 'expense',
    category: bill.category || 'other',
    amount: bill.amount,
    date: paidDate,
    note: `${bill.name} bill`,
    billId: bill.id,
    createdAt: stamp(),
  });
  await db.put(STORES.transactions, transaction);
  await recordSync('transaction', 'create', transaction);

  // Paying a bill can push its category over a budget line — check quietly.
  await generateBudgetAlerts(paidDate.slice(0, 7)).catch(() => []);

  return { bill: updated, payment, transaction };
}

/* =========================== Transactions =============================== */

// BACKEND: GET /api/expenses?month=YYYY-MM
export async function getExpenses(month = monthKey(new Date())) {
  await initApi();
  const all = await db.getAll(STORES.transactions);
  return all
    .filter((t) => t.type === 'expense' && (t.date || '').startsWith(month))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

// BACKEND: GET /api/income?month=YYYY-MM
export async function getIncome(month = monthKey(new Date())) {
  await initApi();
  const all = await db.getAll(STORES.transactions);
  return all
    .filter((t) => t.type === 'income' && (t.date || '').startsWith(month))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

// BACKEND: GET /api/transactions?month=YYYY-MM
export async function getTransactions(month = monthKey(new Date())) {
  await initApi();
  const all = await db.getAll(STORES.transactions);
  return all
    .filter((t) => (t.date || '').startsWith(month))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

// BACKEND: POST /api/expenses  (PUT /api/expenses/:id)
export async function saveTransaction(input) {
  await initApi();
  const existing = input.id ? await db.get(STORES.transactions, input.id) : null;
  const tx = touch({
    id: input.id || uuid(),
    type: input.type === 'income' ? 'income' : 'expense',
    category: input.category || (input.type === 'income' ? 'other-income' : 'other'),
    amount: Math.round((Number(input.amount) || 0) * 100) / 100,
    date: input.date || todayISO(),
    note: input.note || '',
    billId: input.billId || null,
    createdAt: existing?.createdAt || stamp(),
  });
  await db.put(STORES.transactions, tx);
  await recordSync('transaction', existing ? 'update' : 'create', tx);

  // Budget nudges are derived, never stored twice: 80% warns, 100% closes the line.
  if (tx.type === 'expense') {
    await generateBudgetAlerts(tx.date.slice(0, 7)).catch(() => []);
  }
  return tx;
}

// BACKEND: DELETE /api/expenses/:id
export async function deleteTransaction(id) {
  await initApi();
  await db.remove(STORES.transactions, id);
  await recordSync('transaction', 'delete', { id });
}

/* ============================== Budgets ================================= */

// BACKEND: GET /api/budgets?month=YYYY-MM
export async function getBudgets(month = monthKey(new Date())) {
  await initApi();
  const budgets = await db.getAll(STORES.budgets);
  return budgets
    .filter((b) => b.month === month)
    .sort((a, b) => (a.category < b.category ? -1 : 1));
}

// BACKEND: PUT /api/budgets/:month/:category
export async function saveBudget({ month, category, limit }) {
  await initApi();
  const existing = (await getBudgets(month)).find((b) => b.category === category);
  const budget = touch({
    id: existing?.id || uuid(),
    month,
    category,
    limit: Math.max(0, Number(limit) || 0),
    createdAt: existing?.createdAt || stamp(),
  });
  await db.put(STORES.budgets, budget);
  await recordSync('budget', existing ? 'update' : 'create', budget);
  return budget;
}

// BACKEND: DELETE /api/budgets/:id
export async function deleteBudget(id) {
  await initApi();
  await db.remove(STORES.budgets, id);
  await recordSync('budget', 'delete', { id });
}

/** Joined budget + actual rows for one month. */
// BACKEND: GET /api/money/overview?month=YYYY-MM
export async function getMoneyOverview(month = monthKey(new Date())) {
  const [budgets, transactions] = await Promise.all([getBudgets(month), getTransactions(month)]);
  const expenses = transactions.filter((t) => t.type === 'expense');
  const income = transactions.filter((t) => t.type === 'income');
  const spentByCategory = {};
  expenses.forEach((t) => {
    spentByCategory[t.category] = (spentByCategory[t.category] || 0) + Number(t.amount || 0);
  });

  const rows = budgets.map((b) => {
    const spent = Math.round((spentByCategory[b.category] || 0) * 100) / 100;
    return {
      ...b,
      spent,
      remaining: Math.round((b.limit - spent) * 100) / 100,
      percent: b.limit ? Math.round((spent / b.limit) * 100) : 0,
      label: categoryMeta(b.category).label,
    };
  });

  const totalBudget = budgets.reduce((sum, b) => sum + Number(b.limit || 0), 0);
  const totalSpent = expenses.reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const totalIncome = income.reduce((sum, t) => sum + Number(t.amount || 0), 0);

  return {
    month,
    rows,
    expenses,
    income,
    spentByCategory,
    totals: {
      budget: totalBudget,
      spent: Math.round(totalSpent * 100) / 100,
      income: Math.round(totalIncome * 100) / 100,
      net: Math.round((totalIncome - totalSpent) * 100) / 100,
      percent: totalBudget ? Math.round((totalSpent / totalBudget) * 100) : 0,
    },
    expenseCategories: EXPENSE_CATEGORIES,
    incomeCategories: INCOME_CATEGORIES,
  };
}

/**
 * Warn once per category/month at 80%, and once more when the line closes at
 * 100%. Keys make the check idempotent, so saving several expenses never
 * repeats the same nudge.
 */
// BACKEND: POST /api/notifications/budget-alerts?month=YYYY-MM
export async function generateBudgetAlerts(month = monthKey(new Date())) {
  await initApi();
  const profile = await getProfile();
  if (profile && profile.notifyBudgets === false) return [];

  const overview = await getMoneyOverview(month);
  if (!overview.rows.length) return [];

  const existing = await getNotifications();
  const seen = new Set(existing.map((n) => n.key).filter(Boolean));
  const monthName = monthLabel(month);
  const created = [];

  overview.rows.forEach((row) => {
    if (!row.limit || !row.percent) return;
    const level = row.percent >= 100 ? 100 : row.percent >= 80 ? 80 : 0;
    if (!level) return;
    const key = `budget:${month}:${row.category}:${level}`;
    if (seen.has(key)) return;
    seen.add(key);

    const closed = level === 100;
    created.push({
      type: 'budget',
      key,
      title: closed
        ? `${row.label} budget is spent`
        : `${row.label} is at ${row.percent}% of its budget`,
      body: closed
        ? `${money(row.spent, { cents: false })} of ${money(row.limit, { cents: false })} in ${monthName}. The line is closed for this month.`
        : `${money(row.spent, { cents: false })} of ${money(row.limit, { cents: false })} in ${monthName}. A small pause may help.`,
      link: '#/money',
    });
  });

  for (const item of created) await addNotification(item);

  if (created.length && typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('pla:budget-alert', { detail: { month, alerts: created } })
    );
  }
  return created;
}

/** Last N days, grouped by date, for the daily trend chart. */
// BACKEND: GET /api/expenses/trend?days=14
export async function getSpendingTrend(days = 14, endDate = todayISO()) {
  await initApi();
  const start = addDays(endDate, -(days - 1));
  const all = await db.getAll(STORES.transactions);
  const buckets = new Map();
  for (let i = 0; i < days; i += 1) buckets.set(addDays(start, i), 0);
  all.forEach((t) => {
    if (t.type !== 'expense' || !t.date) return;
    if (t.date >= start && t.date <= endDate && buckets.has(t.date)) {
      buckets.set(t.date, buckets.get(t.date) + Number(t.amount || 0));
    }
  });
  return Array.from(buckets.entries()).map(([date, amount]) => ({
    date,
    amount: Math.round(amount * 100) / 100,
  }));
}

/** Sum of expenses in a date range (inclusive), used by review + dashboard. */
// BACKEND: GET /api/expenses/range?from=&to=
export async function getSpentBetween(fromISO, toISO) {
  await initApi();
  const all = await db.getAll(STORES.transactions);
  return Math.round(
    all
      .filter((t) => t.type === 'expense' && t.date >= fromISO && t.date <= toISO)
      .reduce((sum, t) => sum + Number(t.amount || 0), 0) * 100
  ) / 100;
}

// BACKEND: GET /api/transactions/range?from=&to=
export async function getTransactionsBetween(fromISO, toISO) {
  await initApi();
  const all = await db.getAll(STORES.transactions);
  return all.filter((t) => t.date >= fromISO && t.date <= toISO);
}

/* =============================== Habits ================================= */

// BACKEND: GET /api/habits
export async function getHabits() {
  await initApi();
  const habits = await db.getAll(STORES.habits);
  return habits.sort((a, b) => (a.name < b.name ? -1 : 1));
}

// BACKEND: POST /api/habits  (PUT /api/habits/:id)
export async function saveHabit(input) {
  await initApi();
  const existing = input.id ? await db.get(STORES.habits, input.id) : null;
  const habit = touch({
    id: input.id || uuid(),
    name: (input.name || 'New habit').trim(),
    icon: input.icon || 'sprout',
    tone: input.tone || 'sage',
    cadence: input.cadence || 'weekly',
    targetPerWeek: Math.min(7, Math.max(1, Number(input.targetPerWeek) || 3)),
    log: input.log || existing?.log || {},
    createdAt: existing?.createdAt || stamp(),
  });
  await db.put(STORES.habits, habit);
  await recordSync('habit', existing ? 'update' : 'create', habit);
  return habit;
}

// BACKEND: PUT /api/habits/:id/checkins/:date
export async function toggleHabit(id, date = todayISO()) {
  const habit = await db.get(STORES.habits, id);
  if (!habit) throw new Error('Habit not found');
  const log = { ...(habit.log || {}) };
  if (log[date]) delete log[date];
  else log[date] = true;
  const next = touch({ ...habit, log });
  await db.put(STORES.habits, next);
  await recordSync('habit', 'checkin', { id, date, checked: Boolean(log[date]) });
  return next;
}

// BACKEND: DELETE /api/habits/:id
export async function deleteHabit(id) {
  await initApi();
  await db.remove(STORES.habits, id);
  await recordSync('habit', 'delete', { id });
}

/* ================================ Goals ================================= */

// BACKEND: GET /api/goals
export async function getGoals() {
  await initApi();
  const goals = await db.getAll(STORES.goals);
  return goals.sort((a, b) => (a.targetDate || '9999') < (b.targetDate || '9999') ? -1 : 1);
}

// BACKEND: POST /api/goals  (PUT /api/goals/:id)
export async function saveGoal(input) {
  await initApi();
  const existing = input.id ? await db.get(STORES.goals, input.id) : null;
  const goal = touch({
    id: input.id || uuid(),
    title: (input.title || 'New goal').trim(),
    note: input.note || '',
    current: Math.max(0, Number(input.current) || 0),
    target: Math.max(1, Number(input.target) || 1),
    unit: input.unit || '%',
    targetDate: input.targetDate || addDays(todayISO(), 30),
    createdAt: existing?.createdAt || stamp(),
  });
  await db.put(STORES.goals, goal);
  await recordSync('goal', existing ? 'update' : 'create', goal);
  return goal;
}

// BACKEND: DELETE /api/goals/:id
export async function deleteGoal(id) {
  await initApi();
  await db.remove(STORES.goals, id);
  await recordSync('goal', 'delete', { id });
}

/* ============================ Check-ins ================================= */

// BACKEND: GET /api/checkins/:date
export async function getCheckin(date = todayISO()) {
  await initApi();
  return db.get(STORES.checkins, date);
}

// BACKEND: GET /api/checkins?from=&to=
export async function getCheckins(fromISO, toISO) {
  await initApi();
  const all = await db.getAll(STORES.checkins);
  return all
    .filter((c) => c.date >= fromISO && c.date <= toISO)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

// BACKEND: PUT /api/checkins/:date
export async function saveCheckin(date, mood, note = '') {
  await initApi();
  const existing = await db.get(STORES.checkins, date);
  const checkin = touch({
    date,
    mood: Math.min(5, Math.max(1, Number(mood) || 3)),
    note,
    createdAt: existing?.createdAt || stamp(),
  });
  await db.put(STORES.checkins, checkin);
  await recordSync('checkin', 'update', checkin);
  return checkin;
}

/* ============================== Planner ================================= */

// BACKEND: POST /api/plan/generate
export async function generatePlan(date = todayISO(), { busy = [], weights = null } = {}) {
  await initApi();
  const [tasks, bills, profile, checkin] = await Promise.all([
    getTasks({ includeDone: false }),
    getBills(),
    getProfile(),
    getCheckin(date),
  ]);

  const { PLANNER_CONFIG, generatePlan: pureGeneratePlan } = await import('./planner.js');
  const config = weights
    ? {
        ...PLANNER_CONFIG,
        weights: {
          urgency: Math.max(0, Number(weights.urgency ?? PLANNER_CONFIG.weights.urgency)),
          importance: Math.max(0, Number(weights.importance ?? PLANNER_CONFIG.weights.importance)),
          effort: Math.max(0, Number(weights.effort ?? PLANNER_CONFIG.weights.effort)),
        },
      }
    : PLANNER_CONFIG;

  const plan = pureGeneratePlan({
    date,
    tasks,
    bills,
    profile,
    mood: checkin?.mood || 4,
    busy,
    config,
  });

  const saved = touch({
    ...plan,
    status: 'proposed',
    updatedAt: stamp(),
    createdAt: stamp(),
  });
  // A fresh plan is proposed, not accepted.
  saved.createdAt = plan.generatedAt;
  await db.put(STORES.plans, saved);
  await recordSync('plan', 'generate', saved);
  return saved;
}

// BACKEND: GET /api/plan?date=YYYY-MM-DD
export async function getPlan(date = todayISO()) {
  await initApi();
  return db.get(STORES.plans, date);
}

// BACKEND: GET /api/plan/today (generate if absent)
export async function getOrCreatePlan(date = todayISO()) {
  const existing = await getPlan(date);
  if (existing && existing.status !== 'rejected') return existing;
  return generatePlan(date);
}

// BACKEND: POST /api/plan/:date/accept
export async function acceptPlan(date = todayISO(), blocks = null) {
  const existing = await getPlan(date);
  if (!existing) throw new Error('No plan to accept');
  const plan = touch({
    ...existing,
    blocks: blocks || existing.blocks,
    status: 'accepted',
  });
  await db.put(STORES.plans, plan);
  await recordSync('plan', 'accept', plan);
  return plan;
}

// BACKEND: POST /api/plan/:date/reject
export async function rejectPlan(date = todayISO()) {
  const existing = await getPlan(date);
  if (!existing) return null;
  const plan = touch({ ...existing, status: 'rejected' });
  await db.put(STORES.plans, plan);
  await recordSync('plan', 'reject', plan);
  return plan;
}

// BACKEND: PUT /api/plan/:date/blocks
export async function updatePlanBlocks(date, blocks) {
  const existing = await getPlan(date);
  if (!existing) throw new Error('No plan to update');
  const plan = touch({ ...existing, blocks, status: existing.status === 'accepted' ? 'accepted' : 'proposed' });
  await db.put(STORES.plans, plan);
  await recordSync('plan', 'update', plan);
  return plan;
}

/**
 * Placeholder for a future model-assisted plan.
 * Deliberately returns null so the deterministic planner is used.
 */
// BACKEND: POST /api/plan/ai
export async function askLLM(planInput) {
  void planInput;
  return null;
}

// BACKEND: POST /api/sync
export async function flushQueue() {
  const items = await db.getAll(STORES.syncQueue);
  // No server yet. The queue stays intact and is replayed once an endpoint exists.
  return { pending: items.length, synced: 0, localOnly: true };
}

/* =========================== Notifications ============================== */

// BACKEND: GET /api/notifications
export async function getNotifications() {
  await initApi();
  const items = await db.getAll(STORES.notifications);
  return items.sort((a, b) => (a.ts < b.ts ? 1 : -1));
}

// BACKEND: POST /api/notifications
export async function addNotification({ type = 'system', title, body, link = '', key = null }) {
  await initApi();
  if (key) {
    const existing = (await getNotifications()).find((n) => n.key === key);
    if (existing) return existing;
  }
  const notification = touch({
    id: uuid(),
    type,
    key: key || null,
    title: String(title || '').trim(),
    body: String(body || '').trim(),
    ts: stamp(),
    read: false,
    link,
    createdAt: stamp(),
  });
  await db.put(STORES.notifications, notification);
  await recordSync('notification', 'create', notification);
  return notification;
}

// BACKEND: PATCH /api/notifications/:id/read
export async function markNotificationRead(id, read = true) {
  const item = await db.get(STORES.notifications, id);
  if (!item) return null;
  const next = touch({ ...item, read });
  await db.put(STORES.notifications, next);
  await recordSync('notification', 'update', next);
  return next;
}

// BACKEND: PATCH /api/notifications/read-all
export async function markAllNotificationsRead() {
  await initApi();
  const items = await db.getAll(STORES.notifications);
  await Promise.all(
    items.map(async (item) => {
      if (item.read) return;
      await db.put(STORES.notifications, touch({ ...item, read: true }));
    })
  );
  await recordSync('notification', 'read-all', { at: stamp() });
}

// BACKEND: DELETE /api/notifications/:id
export async function deleteNotification(id) {
  await initApi();
  await db.remove(STORES.notifications, id);
  await recordSync('notification', 'delete', { id });
}

// BACKEND: POST /api/notifications/generate
export async function generateReminders(date = todayISO()) {
  await initApi();
  const [bills, tasks, profile, existing] = await Promise.all([
    getBills(),
    getTasks({ includeDone: false }),
    getProfile(),
    getNotifications(),
  ]);

  const prefs = {
    bills: profile?.notifyBills !== false,
    tasks: profile?.notifyTasks !== false,
    budgets: profile?.notifyBudgets !== false,
    review: profile?.notifyReview !== false,
  };
  const defaultLead = clampNumber(profile?.remindDaysBefore ?? 3, 0, 30);
  const seenKeys = new Set(existing.map((n) => n.key).filter(Boolean));
  const seenTitles = new Set(existing.filter((n) => !n.read).map((n) => n.title));
  const created = [];
  const push = (item) => {
    if (item.key && seenKeys.has(item.key)) return;
    if (seenTitles.has(item.title)) return;
    if (item.key) seenKeys.add(item.key);
    created.push(item);
  };

  if (prefs.bills) {
    bills.forEach((bill) => {
      const days = bill.nextDue ? diffDays(date, bill.nextDue) : 99;
      const lead = clampNumber(bill.remindDaysBefore ?? defaultLead, 0, 30);
      if (days < 0 || days > lead) return;
      push({
        type: 'bill',
        key: `bill:${bill.id}:${bill.nextDue}:${lead}`,
        title:
          days === 0
            ? `${bill.name} is due today`
            : `${bill.name} is due in ${days} day${days === 1 ? '' : 's'}`,
        body: `${money(bill.amount)} · ${formatDate(bill.nextDue, 'short')}`,
        link: '#/bills',
      });
    });
  }

  if (prefs.tasks) {
    const overdue = tasks.filter((t) => t.due && diffDays(t.due, date) > 0);
    if (overdue.length) {
      push({
        type: 'task',
        key: `tasks:overdue:${date}`,
        title: 'Overdue tasks need a moment',
        body: `${overdue.length} task${overdue.length === 1 ? '' : 's'} slipped past the date. Small ones first.`,
        link: '#/tasks',
      });
    }
  }

  if (prefs.review) {
    const weekday = new Date(`${date}T12:00:00`).getDay(); // 0 Sunday, 1 Monday
    if (weekday === 0 || weekday === 1) {
      const weekStart = startOfWeek(date);
      push({
        type: 'system',
        key: `review:${weekStart}`,
        title: 'Your weekly review is ready',
        body: 'Seven days in one page — what moved, what slipped, and one thing for next week.',
        link: '#/review',
      });
    }
  }

  for (const item of created) await addNotification(item);

  if (prefs.budgets) {
    const budgetAlerts = await generateBudgetAlerts(monthKey(date)).catch(() => []);
    created.push(...budgetAlerts);
  }

  return created;
}

// BACKEND: GET /api/notifications/unread-count
export async function getUnreadCount() {
  const items = await getNotifications();
  return items.filter((n) => !n.read).length;
}

// BACKEND: GET /api/review/week?date=YYYY-MM-DD
export async function getWeeklyReview(date = todayISO()) {
  await initApi();
  const [tasks, transactions, habits, goals] = await Promise.all([
    getTasks({ includeDone: true }),
    getTransactionsBetween(addDays(date, -13), date),
    getHabits(),
    getGoals(),
  ]);
  const { buildWeeklyReview } = await import('./analytics.js');
  return buildWeeklyReview({ tasks, transactions, habits, goals, refISO: date });
}

/* =============================== Leisure ================================ */

const LEISURE_KEY = 'leisure';
const LEISURE_DEFAULTS = {
  pairs: { plays: 0, wins: 0, bestMoves: null, level: 1, cleared: 0 },
  lantern: { plays: 0, wins: 0, bestMoves: null, level: 1, cleared: 0 },
  words: { plays: 0, wins: 0, bestMisses: null, perfect: 0, level: 1, cleared: 0 },
  trail: { plays: 0, wins: 0, bestMisses: null, perfect: 0, level: 1, cleared: 0 },
  odd: { plays: 0, wins: 0, bestMisses: null, perfect: 0, level: 1, cleared: 0 },
  pattern: { plays: 0, wins: 0, bestMisses: null, perfect: 0, level: 1, cleared: 0 },
  premium: { unlocked: false, since: null, source: null },
  lastPlayed: null,
};

const mergeLeisure = (value = {}) => ({
  ...LEISURE_DEFAULTS,
  ...value,
  pairs: { ...LEISURE_DEFAULTS.pairs, ...(value.pairs || {}) },
  lantern: { ...LEISURE_DEFAULTS.lantern, ...(value.lantern || {}) },
  words: { ...LEISURE_DEFAULTS.words, ...(value.words || {}) },
  trail: { ...LEISURE_DEFAULTS.trail, ...(value.trail || {}) },
  odd: { ...LEISURE_DEFAULTS.odd, ...(value.odd || {}) },
  pattern: { ...LEISURE_DEFAULTS.pattern, ...(value.pattern || {}) },
  premium: { ...LEISURE_DEFAULTS.premium, ...(value.premium || {}) },
});

// BACKEND: GET /api/leisure
export async function getLeisureState() {
  await initApi();
  const row = await db.get(STORES.meta, LEISURE_KEY);
  return mergeLeisure(row?.value || {});
}

// BACKEND: PUT /api/leisure
export async function saveLeisureState(patch = {}) {
  await initApi();
  const current = await getLeisureState();
  const next = mergeLeisure({
    ...current,
    ...patch,
    pairs: { ...current.pairs, ...(patch.pairs || {}) },
    lantern: { ...current.lantern, ...(patch.lantern || {}) },
    words: { ...current.words, ...(patch.words || {}) },
    trail: { ...current.trail, ...(patch.trail || {}) },
    odd: { ...current.odd, ...(patch.odd || {}) },
    pattern: { ...current.pattern, ...(patch.pattern || {}) },
    premium: { ...current.premium, ...(patch.premium || {}) },
    lastPlayed: patch.lastPlayed || stamp(),
  });
  const record = { key: LEISURE_KEY, value: next, updatedAt: stamp() };
  await db.put(STORES.meta, record);
  await recordSync('leisure', 'update', record);
  return next;
}

/* =============================== Export ================================= */

// BACKEND: GET /api/export/tasks
export async function getTasksForExport() {
  return getTasks();
}

// BACKEND: GET /api/export/expenses?from=&to=
export async function getExpensesForExport(fromISO = '2000-01-01', toISO = todayISO()) {
  await initApi();
  const all = await db.getAll(STORES.transactions);
  return all.filter((t) => t.date >= fromISO && t.date <= toISO).sort((a, b) => (a.date < b.date ? 1 : -1));
}

// BACKEND: GET /api/export/all
export async function getAllForExport() {
  await initApi();
  const [tasks, bills, transactions, budgets, habits, goals] = await Promise.all([
    db.getAll(STORES.tasks),
    db.getAll(STORES.bills),
    db.getAll(STORES.transactions),
    db.getAll(STORES.budgets),
    db.getAll(STORES.habits),
    db.getAll(STORES.goals),
  ]);
  return { tasks, bills, transactions, budgets, habits, goals };
}
