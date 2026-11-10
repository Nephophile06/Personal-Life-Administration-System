/**
 * Pure, testable day planner. No DOM, no storage, no network.
 *
 * score = w1·urgency + w2·importance + w3·effortFactor
 * Urgency peaks when a deadline is near (overdue = 1). The effort factor
 * favours short tasks when the available time is tight. A low mood reduces
 * the total load and caps the number of blocks.
 */

export const PLANNER_CONFIG = {
  weights: { urgency: 0.55, importance: 0.3, effort: 0.15 },
  breakMinutes: 8,
  breakMinGap: 5,
  maxBlocks: 6,
  maxBills: 3,
  lowMood: 2,
  lowMoodCapacity: 0.62,
  defaultEstimate: 30,
  minEstimate: 10,
  maxEstimate: 120,
  horizonDays: 14,
};

const IMPORTANCE = { high: 0.95, medium: 0.62, low: 0.32 };
const pad = (n) => String(n).padStart(2, '0');

export const toMinutes = (value, fallback = 0) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const m = String(value || '').match(/(\d{1,2}):(\d{2})/);
  if (!m) return fallback;
  return Number(m[1]) * 60 + Number(m[2]);
};

export const fromMinutes = (mins) => {
  const m = ((Math.round(mins) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
};

export const isoAt = (date, mins) => `${date}T${fromMinutes(mins)}`;

export function daysUntil(dateISO, dueISO) {
  if (!dueISO) return null;
  const [y1, m1, d1] = dateISO.split('-').map(Number);
  const [y2, m2, d2] = dueISO.split('-').map(Number);
  const a = Date.UTC(y1, m1 - 1, d1);
  const b = Date.UTC(y2, m2 - 1, d2);
  return Math.round((b - a) / 86400000);
}

export function urgencyOf(dueISO, dateISO) {
  const days = daysUntil(dateISO, dueISO);
  if (days === null) return 0.14;
  if (days < 0) return 1;
  if (days === 0) return 0.95;
  if (days === 1) return 0.8;
  if (days <= 3) return 0.62;
  if (days <= 7) return 0.4;
  if (days <= PLANNER_CONFIG.horizonDays) return 0.22;
  return 0.1;
}

export function effortOf(estimate, availableMinutes) {
  const est = Number(estimate) || PLANNER_CONFIG.defaultEstimate;
  const room = Math.max(60, Number(availableMinutes) || 60);
  return Math.max(0, Math.min(1, 1 - est / room));
}

export function scoreTask(task, { date, availableMinutes = 480, weights = PLANNER_CONFIG.weights } = {}) {
  const urgency = urgencyOf(task.due, date);
  const importance = IMPORTANCE[task.priority] ?? 0.5;
  const effort = effortOf(task.estimate, availableMinutes);
  const score = urgency * weights.urgency + importance * weights.importance + effort * weights.effort;
  return {
    score: Math.round(score * 1000) / 1000,
    urgency,
    importance,
    effort,
  };
}

function reasonFor(task, date, score) {
  const days = daysUntil(date, task.due);
  if (days !== null && days < 0) {
    return days === -1 ? 'Overdue since yesterday — first clear slot.' : `Overdue by ${-days} days — clear it first.`;
  }
  if (days === 0) {
    return task.priority === 'high' ? 'Due today, high priority.' : 'Due today — a small, timely win.';
  }
  if (days === 1) {
    return task.priority === 'high' ? 'Due tomorrow, high priority.' : 'Due tomorrow, so today is kinder.';
  }
  if (task.priority === 'high') return 'High priority with a little breathing room.';
  if ((task.estimate || 30) <= 15) return 'A short win for this gap.';
  if (score.urgency >= 0.6) return 'Deadline is close; giving it focus.';
  return 'Fits this slot without crowding the day.';
}

function subtractBusy(windows, busy = []) {
  let segments = [...windows];
  busy
    .map((b) => ({ start: toMinutes(b.start), end: toMinutes(b.end) }))
    .filter((b) => b.end > b.start)
    .forEach((b) => {
      const next = [];
      segments.forEach((seg) => {
        if (b.end <= seg.start || b.start >= seg.end) {
          next.push(seg);
          return;
        }
        if (b.start > seg.start) next.push({ start: seg.start, end: b.start });
        if (b.end < seg.end) next.push({ start: b.end, end: seg.end });
      });
      segments = next;
    });
  return segments.filter((s) => s.end - s.start >= 10).sort((a, b) => a.start - b.start);
}

function place(segments, minutes, buffer = 0) {
  for (let i = 0; i < segments.length; i += 1) {
    const seg = segments[i];
    if (seg.end - seg.start >= minutes) {
      const start = seg.start;
      const end = start + minutes;
      const nextStart = end + buffer;
      if (nextStart < seg.end) segments[i] = { start: nextStart, end: seg.end };
      else segments.splice(i, 1);
      return { start, end };
    }
  }
  return null;
}

function blockFor({ kind, task, bill, start, end, reason, mood, score = null }) {
  return {
    id: `${kind}-${task?.id || bill?.id || start}`,
    kind,
    taskId: task?.id || null,
    billId: bill?.id || null,
    title: task?.title || bill?.name || 'Break',
    start: start,
    end: end,
    startTime: start.split('T')[1] || fromMinutes(0),
    endTime: end.split('T')[1] || fromMinutes(0),
    minutes: Math.round((toMinutes(end.split('T')[1]) - toMinutes(start.split('T')[1])) || 0),
    reason,
    mood: mood || null,
    score: score?.score ?? null,
    urgency: score?.urgency ?? null,
    importance: score?.importance ?? null,
    effort: score?.effort ?? null,
  };
}

/**
 * @param {Object} input
 * @param {string} input.date          YYYY-MM-DD
 * @param {Array}  input.tasks         incomplete tasks
 * @param {Array}  input.bills         unpaid bills
 * @param {Object} input.profile       {workStart, workEnd}
 * @param {number} input.mood          1–5
 * @param {Array}  input.busy          [{start,end}] already-taken time
 * @param {Object} input.config
 */
export function generatePlan({
  date,
  tasks = [],
  bills = [],
  profile = {},
  mood = 4,
  busy = [],
  config = PLANNER_CONFIG,
} = {}) {
  if (!date) throw new Error('generatePlan needs a date');

  const workStart = toMinutes(profile.workStart || '09:00', 540);
  const workEnd = toMinutes(profile.workEnd || '17:30', 1050);
  const start = Math.min(workStart, workEnd - 30);
  const end = Math.max(workEnd, start + 30);
  const segments = subtractBusy([{ start, end }], busy);
  const availableMinutes = Math.max(
    0,
    segments.reduce((sum, s) => sum + (s.end - s.start), 0)
  );

  const lowMood = mood <= config.lowMood;
  const moodCapacity = lowMood ? config.lowMoodCapacity : mood === 3 ? 0.82 : mood === 4 ? 0.94 : 1;
  const capacity = availableMinutes * moodCapacity;
  const maxTasks = lowMood ? 3 : config.maxBlocks;

  const blocks = [];
  let used = 0;

  // Bills that are due (or overdue) on this date become quick, concrete blocks.
  const dueBills = bills
    .filter((b) => b.nextDue && daysUntil(date, b.nextDue) <= 0)
    .sort((a, b) => (a.nextDue < b.nextDue ? -1 : 1))
    .slice(0, config.maxBills);

  dueBills.forEach((bill) => {
    if (used + 10 > capacity) return;
    const slot = place(segments, 10, config.breakMinGap);
    if (!slot) return;
    const days = daysUntil(date, bill.nextDue);
    blocks.push(
      blockFor({
        kind: 'bill',
        bill,
        start: isoAt(date, slot.start),
        end: isoAt(date, slot.end),
        reason:
          days < 0
            ? 'Overdue bill — a two-minute transfer.'
            : 'Due today — clear it while it’s small.',
        mood,
      })
    );
    used += 10;
  });

  const candidates = tasks
    .filter((t) => !t.done)
    .map((t) => {
      const estimate = Math.round(
        Math.min(config.maxEstimate, Math.max(config.minEstimate, Number(t.estimate) || config.defaultEstimate)) / 5
      ) * 5;
      const scored = scoreTask({ ...t, estimate }, { date, availableMinutes, weights: config.weights });
      return { task: { ...t, estimate }, ...scored };
    })
    .filter((t) => {
      const days = daysUntil(date, t.task.due);
      return days === null || days <= config.horizonDays;
    })
    .sort((a, b) => b.score - a.score || (a.task.order ?? 0) - (b.task.order ?? 0));

  let placed = 0;
  const unplannedTaskIds = [];

  for (const candidate of candidates) {
    const { task, ...score } = candidate;
    if (placed >= maxTasks) {
      unplannedTaskIds.push(task.id);
      continue;
    }
    if (used + task.estimate > capacity) {
      unplannedTaskIds.push(task.id);
      continue;
    }
    const slot = place(segments, task.estimate, config.breakMinutes);
    if (!slot) {
      unplannedTaskIds.push(task.id);
      continue;
    }
    blocks.push(
      blockFor({
        kind: 'task',
        task,
        start: isoAt(date, slot.start),
        end: isoAt(date, slot.end),
        reason: lowMood ? 'Kept light — your energy comes first.' : reasonFor(task, date, score),
        mood,
        score,
      })
    );
    used += task.estimate + config.breakMinutes;
    placed += 1;
  }

  blocks.sort((a, b) => (a.start < b.start ? -1 : 1));

  // Turn reserved gaps into visible, gentle breaks.
  const withBreaks = [];
  blocks.forEach((block, index) => {
    withBreaks.push(block);
    const next = blocks[index + 1];
    if (!next) return;
    const gap = toMinutes(next.startTime) - toMinutes(block.endTime);
    if (gap >= config.breakMinGap) {
      const breakMins = Math.min(config.breakMinutes, gap);
      const bStart = toMinutes(block.endTime);
      withBreaks.push({
        id: `break-${bStart}`,
        kind: 'break',
        taskId: null,
        billId: null,
        title: lowMood ? 'Breathe' : 'A short break',
        start: isoAt(date, bStart),
        end: isoAt(date, bStart + breakMins),
        startTime: fromMinutes(bStart),
        endTime: fromMinutes(bStart + breakMins),
        minutes: breakMins,
        reason: lowMood ? 'Slower is still forward.' : 'Tea, stretch, look out of a window.',
        mood,
      });
    }
  });

  withBreaks.sort((a, b) => (a.start < b.start ? -1 : 1));

  const focusMinutes = withBreaks
    .filter((b) => b.kind !== 'break')
    .reduce((sum, b) => sum + b.minutes, 0);

  return {
    date,
    blocks: withBreaks,
    status: 'proposed',
    mood,
    generatedAt: new Date().toISOString(),
    stats: {
      focusMinutes,
      availableMinutes,
      capacityMinutes: Math.round(capacity),
      taskBlocks: withBreaks.filter((b) => b.kind === 'task').length,
      billBlocks: withBreaks.filter((b) => b.kind === 'bill').length,
      breakBlocks: withBreaks.filter((b) => b.kind === 'break').length,
      lowMood,
      unplannedTaskIds,
    },
    config: {
      weights: config.weights,
      breakMinutes: config.breakMinutes,
      maxBlocks: config.maxBlocks,
    },
  };
}
