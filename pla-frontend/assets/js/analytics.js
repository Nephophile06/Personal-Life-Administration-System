/** Pure derived stats used by dashboard, habits, money and weekly review. */
import { addDays, diffDays, startOfWeek, todayISO, weekDays, money } from './ui/format.js';
import { categoryMeta as catMeta } from './constants.js';

export const clampPct = (n) => Math.max(0, Math.min(100, Number(n) || 0));

export function goalPercent(goal) {
  if (!goal?.target) return 0;
  return clampPct((Number(goal.current) / Number(goal.target)) * 100);
}

export function budgetLevel(percent) {
  if (Number(percent) >= 100) return 'over';
  if (Number(percent) >= 80) return 'warn';
  return 'ok';
}

export function habitDates(habit) {
  return Object.keys(habit?.log || {}).filter((d) => habit.log[d]).sort();
}

export function habitWeekCount(habit, refISO = todayISO()) {
  const days = weekDays(refISO);
  return days.filter((d) => habit?.log?.[d]).length;
}

export function habitStreak(habit, refISO = todayISO()) {
  const log = habit?.log || {};
  let cursor = refISO;
  if (!log[cursor]) cursor = addDays(refISO, -1);
  let streak = 0;
  // Guard against runaway loops on malformed data.
  for (let i = 0; i < 400; i += 1) {
    if (!log[cursor]) break;
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function habitBestStreak(habit) {
  const dates = habitDates(habit);
  let best = 0;
  let run = 0;
  let prev = null;
  dates.forEach((d) => {
    if (prev && diffDays(prev, d) === 1) run += 1;
    else run = 1;
    best = Math.max(best, run);
    prev = d;
  });
  return best;
}

export function habitSummary(habits, refISO = todayISO()) {
  return habits
    .map((h) => ({
      ...h,
      weekCount: habitWeekCount(h, refISO),
      streak: habitStreak(h, refISO),
      best: habitBestStreak(h),
      doneToday: Boolean(h.log?.[refISO]),
    }))
    .sort((a, b) => b.weekCount / b.targetPerWeek - a.weekCount / a.targetPerWeek);
}

export function spendingByCategory(expenses = []) {
  const map = new Map();
  expenses.forEach((t) => {
    map.set(t.category, (map.get(t.category) || 0) + Number(t.amount || 0));
  });
  return Array.from(map.entries())
    .map(([category, amount]) => ({
      category,
      label: catMeta(category).label,
      amount: Math.round(amount * 100) / 100,
    }))
    .sort((a, b) => b.amount - a.amount);
}

export function topCategory(expenses = []) {
  const list = spendingByCategory(expenses);
  return list[0] || null;
}

export function weekRange(refISO = todayISO()) {
  const start = addDays(refISO, -6);
  const prevStart = addDays(refISO, -13);
  const prevEnd = addDays(refISO, -7);
  return { start, end: refISO, prevStart, prevEnd };
}

export function buildWeeklyReview({ tasks = [], transactions = [], habits = [], goals = [], refISO = todayISO() }) {
  const range = weekRange(refISO);
  const weekStart = startOfWeek(refISO);
  const weekEnd = addDays(weekStart, 6);

  const completed = tasks.filter(
    (t) => t.done && t.completedAt && t.completedAt.slice(0, 10) >= range.start && t.completedAt.slice(0, 10) <= refISO
  );
  const created = tasks.filter((t) => (t.createdAt || '').slice(0, 10) >= weekStart && (t.createdAt || '').slice(0, 10) <= weekEnd);
  const overdue = tasks.filter((t) => !t.done && t.due && t.due < refISO);

  const spendNow = transactions
    .filter((t) => t.type === 'expense' && t.date >= range.start && t.date <= range.end)
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const spendPrev = transactions
    .filter((t) => t.type === 'expense' && t.date >= range.prevStart && t.date <= range.prevEnd)
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);

  const nowExpenses = transactions.filter((t) => t.type === 'expense' && t.date >= range.start && t.date <= range.end);
  const cats = spendingByCategory(nowExpenses);

  const habitRows = habitSummary(habits, refISO);
  const bestHabit = habitRows.slice().sort((a, b) => b.weekCount - a.weekCount)[0] || null;
  const activeGoals = goals.slice().sort((a, b) => goalPercent(b) - goalPercent(a));

  const change = spendPrev ? Math.round(((spendNow - spendPrev) / spendPrev) * 100) : 0;

  const suggestions = [];
  if (overdue.length) {
    const small = overdue.filter((t) => Number(t.estimate || 30) <= 20);
    suggestions.push(
      small.length
        ? `${small.length === 1 ? small[0].title : `${small.length} small overdue tasks`} can be cleared in one 20-minute slot.`
        : `${overdue.length} overdue task${overdue.length === 1 ? '' : 's'} — pick the oldest on Monday morning.`
    );
  }
  if (spendPrev && change > 8 && cats.length) {
    suggestions.push(`Spending is up ${change}% on last week; ${cats[0].label.toLowerCase()} took the most (${money(cats[0].amount, { cents: false })}). A smaller envelope might feel better.`);
  } else if (spendNow > 0 && change < -8) {
    suggestions.push(`Spending fell ${Math.abs(change)}% on last week — a quiet win worth keeping.`);
  }
  if (bestHabit) {
    const remaining = Math.max(0, bestHabit.targetPerWeek - bestHabit.weekCount);
    suggestions.push(
      remaining
        ? `“${bestHabit.name}” needs ${remaining} more check-in${remaining === 1 ? '' : 's'} to hit your target.`
        : `“${bestHabit.name}” hit its weekly target. Protect the same slot next week.`
    );
  }
  if (activeGoals[0] && goalPercent(activeGoals[0]) >= 60 && suggestions.length < 3) {
    suggestions.push(`“${activeGoals[0].title}” is ${Math.round(goalPercent(activeGoals[0]))}% there. A 45-minute block would keep the momentum.`);
  }
  if (suggestions.length < 2) suggestions.push('Keep one evening next week completely unplanned. Nothing to recover from.');
  if (suggestions.length < 3) suggestions.push('Plan tomorrow before closing the laptop tonight — future-you will thank you.');

  return {
    range,
    completed,
    completedCount: completed.length,
    createdCount: created.length,
    overdue,
    overdueCount: overdue.length,
    spendNow: Math.round(spendNow * 100) / 100,
    spendPrev: Math.round(spendPrev * 100) / 100,
    change,
    topCategories: cats,
    habitRows,
    bestHabit,
    goals: activeGoals,
    suggestions: suggestions.slice(0, 3),
  };
}

/** Formatted money label for compact cards — re-exported for convenience. */
export { money };
