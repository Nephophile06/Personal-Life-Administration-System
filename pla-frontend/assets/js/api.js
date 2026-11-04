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
} from './constants.js';
import { todayISO, addDays, monthKey, diffDays } from './ui/format.js';

const uuid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);

const stamp = () => new Date().toISOString();
const touch = (record) => ({ ...record, updatedAt: stamp(), synced: false });
const maxOrder = (tasks) => tasks.reduce((max, t) => Math.max(max, Number(t.order) || 0), 0);

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
  const task = touch({
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
  });
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
  const existing = input.id ? await db.get(STORES.bills, input.id) : null;
  const bill = touch({
    id: input.id || uuid(),
    name: (input.name || 'New bill').trim(),
    kind: input.kind || 'custom',
    icon: input.icon || 'receipt',
    category: input.category || 'other',
    amount: Number(input.amount) || 0,
    frequency: input.frequency || 'monthly',
    nextDue: input.nextDue || todayISO(),
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
export async function addNotification({ type = 'system', title, body, link = '' }) {
  await initApi();
  const notification = touch({
    id: uuid(),
    type,
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
  const [bills, tasks] = await Promise.all([getBills(), getTasks({ includeDone: false })]);
  const existing = await getNotifications();
  const existingTitles = new Set(existing.filter((n) => !n.read).map((n) => n.title));
  const created = [];

  bills.forEach((bill) => {
    const days = bill.nextDue ? diffDays(date, bill.nextDue) : 99;
    if (days >= 0 && days <= 3) {
      const title =
        days === 0 ? `${bill.name} is due today` : `${bill.name} is due in ${days} day${days === 1 ? '' : 's'}`;
      if (!existingTitles.has(title)) {
        created.push({ type: 'bill', title, body: `$${bill.amount.toFixed(2)} · ${bill.nextDue}`, link: '#/bills' });
      }
    }
  });

  const overdue = tasks.filter((t) => t.due && diffDays(t.due, date) > 0);
  if (overdue.length && !existingTitles.has('Overdue tasks need a moment')) {
    created.push({
      type: 'task',
      title: 'Overdue tasks need a moment',
      body: `${overdue.length} task${overdue.length === 1 ? '' : 's'} slipped past the date. Small ones first.`,
      link: '#/tasks',
    });
  }

  for (const item of created) await addNotification(item);
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
