import { icon } from '../icons.js';
import { pageHead, emptyState } from '../ui/widgets.js';
import { pip } from '../mascot.js';
import { toast } from '../ui/toast.js';
import { categoryMeta, priorityMeta } from '../constants.js';
import {
  esc,
  todayISO,
  addDays,
  diffDays,
  formatDate,
  minutesLabel,
  money,
  timeFromMinutes,
  timeToMinutes,
} from '../ui/format.js';
import {
  getPlan,
  getOrCreatePlan,
  generatePlan,
  acceptPlan,
  rejectPlan,
  updatePlanBlocks,
  getProfile,
  getTasks,
  getBills,
  getCheckin,
} from '../api.js';
import { PLANNER_CONFIG } from '../planner.js';

const DEFAULT_WEIGHTS = { ...PLANNER_CONFIG.weights };

const state = {
  date: todayISO(),
  plan: null,
  profile: {},
  tasks: [],
  bills: [],
  checkin: null,
  weights: { ...DEFAULT_WEIGHTS },
  loading: false,
  busy: false,
};

const clock24 = (mins) => {
  const m = ((Math.round(mins) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

function prettyClock(value) {
  const label = timeFromMinutes(timeToMinutes(value));
  const match = label.match(/^(\d{1,2}:\d{2})(am|pm)$/);
  return match ? { time: match[1], suffix: match[2] } : { time: label, suffix: '' };
}

const statusMeta = {
  proposed: {
    label: 'Draft',
    tone: 'ochre',
    sub: 'Drafted around your deadlines and today’s energy. Nothing is locked.',
  },
  accepted: {
    label: 'Accepted',
    tone: 'sage',
    sub: 'This is the shape of the day now. Move a block and the times will follow.',
  },
  rejected: {
    label: 'Set aside',
    tone: 'danger',
    sub: 'You passed on this one. No plan is a valid plan — draft another when you are ready.',
  },
};

function taskFor(block) {
  return state.tasks.find((t) => t.id === block.taskId) || null;
}

function billFor(block) {
  return state.bills.find((b) => b.id === block.billId) || null;
}

/* ------------------------------------------------------------------ head */

function actionsMarkup() {
  return `
    <div class="day-nav" aria-label="Choose a day">
      <button class="icon-btn icon-btn--bordered" type="button" data-day="-1" aria-label="Previous day" ${state.loading ? 'disabled' : ''}>
        ${icon('chevron-left', 17)}
      </button>
      <span class="day-nav__label">
        <span data-day-weekday>${formatDate(state.date, 'weekday-long')}</span>
        <strong data-day-date>${formatDate(state.date, 'short')}</strong>
      </span>
      <button class="icon-btn icon-btn--bordered" type="button" data-day="1" aria-label="Next day" ${state.loading ? 'disabled' : ''}>
        ${icon('chevron-right', 17)}
      </button>
    </div>
    <button class="chip" type="button" data-day-today ${state.date === todayISO() ? 'hidden' : ''}>
      Today
    </button>
  `;
}

function planHeadMarkup() {
  const status = state.plan?.status;
  const meta = statusMeta[status] || {
    label: 'No plan',
    tone: 'muted',
    sub: state.loading ? 'Reading the day…' : 'No plan is saved for this day yet.',
  };
  const lowMood = state.checkin && Number(state.checkin.mood) <= 2;
  return `
    <div class="plan-card__title">
      <div class="plan-tags">
        <span class="tag tag--${meta.tone}" data-plan-status>${meta.label}</span>
        ${lowMood ? `<span class="tag tag--sage">${icon('leaf', 11)} Low-energy plan</span>` : ''}
      </div>
      <h2>${state.date === todayISO() ? 'The shape of today' : `The shape of ${formatDate(state.date, 'weekday')}`}</h2>
      <p data-plan-sub>${meta.sub}</p>
    </div>
    <div class="plan-card__actions">
      <button class="btn btn--secondary btn--sm" type="button" data-regenerate ${state.busy || state.loading ? 'disabled' : ''}>
        ${icon('refresh', 15)} Regenerate
      </button>
      <button class="btn btn--primary btn--sm" type="button" data-accept ${!state.plan || state.plan.status !== 'proposed' ? 'hidden' : ''}>
        ${icon('check', 15)} Accept plan
      </button>
      <button class="btn btn--ghost btn--sm" type="button" data-reject ${!state.plan || state.plan.status !== 'proposed' ? 'hidden' : ''}>
        Not this one
      </button>
    </div>`;
}

function statsMarkup() {
  const stats = state.plan?.stats;
  if (!stats) return '';
  const start = prettyClock(state.profile.workStart || '09:00');
  const end = prettyClock(state.profile.workEnd || '17:30');
  const unplanned = stats.unplannedTaskIds?.length || 0;
  return `
    <div class="plan-stat">
      <span>Focus sketched</span>
      <strong>${minutesLabel(stats.focusMinutes)}</strong>
      <small>${stats.taskBlocks} task${stats.taskBlocks === 1 ? '' : 's'}${stats.billBlocks ? ` · ${stats.billBlocks} bill${stats.billBlocks === 1 ? '' : 's'}` : ''}</small>
    </div>
    <div class="plan-stat">
      <span>Hours available</span>
      <strong>${minutesLabel(stats.availableMinutes)}</strong>
      <small>${start.time}${start.suffix} – ${end.time}${end.suffix}</small>
    </div>
    <div class="plan-stat">
      <span>Breaks kept</span>
      <strong>${stats.breakBlocks}</strong>
      <small>${stats.lowMood ? 'lighter on purpose' : 'short, deliberate pauses'}</small>
    </div>
    <div class="plan-stat">
      <span>Left off</span>
      <strong>${unplanned}</strong>
      <small>${unplanned ? 'no room, not forgotten' : 'everything that fits, fits'}</small>
    </div>`;
}

/* ----------------------------------------------------------------- blocks */

function blockMarkup(block) {
  const start = prettyClock(block.startTime);
  const end = prettyClock(block.endTime);
  if (block.kind === 'break') {
    return `<li class="plan-block plan-block--break" data-kind="break">
      <span class="plan-block__time"><strong>${start.time}</strong><span>${start.suffix}</span></span>
      <span class="plan-block__rail"><span class="plan-block__dot">${icon('coffee', 14)}</span></span>
      <article class="plan-block__card">
        <div class="plan-block__top">
          <h3>${esc(block.title)}</h3>
          <span class="plan-block__dur">${minutesLabel(block.minutes)}</span>
        </div>
        <p class="plan-block__reason">${esc(block.reason)}</p>
      </article>
    </li>`;
  }

  const task = taskFor(block);
  const bill = billFor(block);
  const cat = task ? categoryMeta(task.category) : null;
  const pri = task ? priorityMeta(task.priority) : null;
  const subs = task?.subtasks || [];
  const doneSubs = subs.filter((s) => s.done).length;
  const glyph = bill ? 'receipt' : cat?.icon || 'tasks';
  const title = block.title;
  const hasScore = Number.isFinite(Number(block.score));
  const pct = (value) => `${Math.round((Number(value) || 0) * 100)}%`;

  return `<li class="plan-block" data-block="${esc(block.id)}" data-kind="${block.kind}" draggable="true">
    <span class="plan-block__time"><strong>${start.time}</strong><span>${start.suffix}</span></span>
    <span class="plan-block__rail"><span class="plan-block__dot tone--${bill ? 'ochre' : cat?.tone || 'accent'}">${icon(glyph, 14)}</span></span>
    <article class="plan-block__card">
      <div class="plan-block__top">
        <h3>${esc(title)}</h3>
        <span class="plan-block__dur">${minutesLabel(block.minutes)}</span>
      </div>
      <p class="plan-block__reason">${esc(block.reason)}</p>
      <div class="plan-block__meta">
        <span class="tag tag--${bill ? 'ochre' : cat?.tone || 'accent'}">${esc(bill ? 'Bill' : cat?.label || 'Task')}</span>
        ${pri && pri.id === 'high' && !bill ? `<span class="status status--due">${icon('flag', 12)} High</span>` : ''}
        ${hasScore ? `<span class="status plan-block__score" title="Puffy’s score ${Number(block.score).toFixed(2)} — urgency ${pct(block.urgency)}, importance ${pct(block.importance)}, fit ${pct(block.effort)}">${icon('sparkles', 12)} ${Number(block.score).toFixed(2)}</span>` : ''}
        ${bill ? `<span class="status">${money(bill.amount)}</span>` : ''}
        ${subs.length ? `<span class="status">${icon('tasks', 12)} ${doneSubs}/${subs.length} steps</span>` : ''}
        <span class="status plan-block__range">${start.time}${start.suffix} – ${end.time}${end.suffix}</span>
      </div>
      <div class="plan-block__tools">
        <button class="icon-btn" type="button" data-block-up aria-label="Move ${esc(title)} earlier">${icon('chevron-up', 14)}</button>
        <button class="icon-btn" type="button" data-block-down aria-label="Move ${esc(title)} later">${icon('chevron-down', 14)}</button>
        ${block.taskId ? `<a class="chip chip--sm" href="#/tasks">${icon('arrow-up-right', 12)} Open task</a>` : ''}
        <span class="plan-block__grip" aria-hidden="true">${icon('grip', 15)}</span>
      </div>
    </article>
  </li>`;
}

function bodyMarkup() {
  if (state.loading) {
    return `<div class="plan-loading" aria-hidden="true">
      ${Array.from({ length: 5 }, () => '<div class="skeleton plan-skeleton"></div>').join('')}
    </div>`;
  }
  if (!state.plan) {
    return `<div class="plan-empty">
      ${pip({ mood: 'thinking', size: 118 })}
      <h3>No plan for this day.</h3>
      <p>${state.date === todayISO()
        ? 'Nothing has been drafted yet. Puffy can shape the hours around what is already on your plate.'
        : 'This day was left open. Go back to today, or draft something for it anyway.'}</p>
      <div class="plan-empty__actions">
        <button class="btn btn--primary" type="button" data-generate>${icon('sparkles', 16)} Draft a plan</button>
        ${state.date !== todayISO() ? `<button class="btn btn--ghost" type="button" data-day-today>Back to today</button>` : ''}
      </div>
    </div>`;
  }
  if (state.plan.status === 'rejected') {
    return `<div class="plan-empty">
      ${pip({ mood: 'sleepy', size: 118 })}
      <h3>Set aside, not failed.</h3>
      <p>Some days do not want a schedule. Draft a new one only if it would make the day lighter.</p>
      <div class="plan-empty__actions">
        <button class="btn btn--primary" type="button" data-generate>${icon('sparkles', 16)} Draft a new plan</button>
        <a class="btn btn--ghost" href="#/tasks">Back to the list</a>
      </div>
    </div>`;
  }

  const blocks = state.plan.blocks || [];
  if (!blocks.length) {
    return emptyState({
      title: 'The hours are clear.',
      text: 'There is nothing urgent enough to place. Add a task, or leave the space alone.',
      action: `<a class="btn btn--secondary" href="#/tasks">${icon('tasks', 16)} Open tasks</a>`,
    });
  }

  return `<ol class="plan-timeline" data-timeline aria-label="Plan timeline">
    ${blocks.map(blockMarkup).join('')}
  </ol>
  <p class="plan-foot">${icon('grip', 14)} Drag a block to change the order — the times will follow. Every block starts from a reason, not a whim.</p>`;
}

/* ------------------------------------------------------------------- rail */

function weightRow(id, label, note, value) {
  return `<div class="weight-row">
    <div class="weight-row__top">
      <label for="weight-${id}">${label}</label>
      <output data-weight-out="${id}">${Math.round(value * 100)}%</output>
    </div>
    <input class="range" id="weight-${id}" type="range" min="0" max="100" step="5"
      value="${Math.round(value * 100)}" data-weight="${id}" />
    <span class="weight-row__hint">${note}</span>
  </div>`;
}

function railMarkup() {
  const stats = state.plan?.stats;
  const unplanned = (stats?.unplannedTaskIds || [])
    .map((id) => state.tasks.find((t) => t.id === id))
    .filter(Boolean);
  const dueBills = state.bills
    .filter((b) => b.nextDue && diffDays(state.date, b.nextDue) <= 0)
    .slice(0, 3);
  const status = state.plan?.status;
  const mood = status === 'accepted' ? 'happy' : status === 'rejected' ? 'sleepy' : 'thinking';
  const pipLine =
    status === 'accepted'
      ? 'The shape is yours now. Move a block if the day disagrees — it often does.'
      : stats?.lowMood
        ? 'You said the tank is low. I kept it to three things and left room to breathe.'
        : 'Nothing here is a command. Argue with it, move a block, or set it aside.';

  return `<section class="card rail-card planner-weights">
      <span class="card-kicker">The rule, not a mood</span>
      <h2 class="rail-card__title">How Puffy decides</h2>
      <p class="rail-card__sub">Urgency meets importance, and short tasks get a nudge when time is tight.</p>
      ${weightRow('urgency', 'Urgency', 'Deadline pressure. Overdue sits at the top.', state.weights.urgency)}
      ${weightRow('importance', 'Importance', 'The priority you set, nothing invented.', state.weights.importance)}
      ${weightRow('effort', 'Effort', 'Favours small wins when the day is crowded.', state.weights.effort)}
      <div class="weight-actions">
        <button class="btn btn--accent-soft btn--sm btn--block" type="button" data-apply-weights ${state.busy ? 'disabled' : ''}>
          ${icon('refresh', 14)} Regenerate with these
        </button>
        <button class="linkish" type="button" data-weight-reset>Reset to Puffy’s defaults</button>
      </div>
    </section>

    <section class="card rail-card">
      <span class="card-kicker">Left off, on purpose</span>
      <h2 class="rail-card__title">What did not fit</h2>
      ${unplanned.length
        ? `<ul class="unplanned">${unplanned
            .slice(0, 4)
            .map(
              (t) => `<li>
                <span>${esc(t.title)}</span>
                <small>${minutesLabel(t.estimate)}</small>
              </li>`
            )
            .join('')}</ul>
          ${unplanned.length > 4 ? `<p class="tiny muted">+ ${unplanned.length - 4} more, still on the list.</p>` : ''}
          <a class="rail-link" href="#/tasks">${icon('tasks', 14)} See the whole list ${icon('arrow-right', 13)}</a>`
        : `<p class="rail-card__sub">${state.plan ? 'Everything that fits is in. Nothing pressing was ignored.' : 'Draft a plan to see what fits and what waits.'}</p>`}
    </section>

    <section class="card rail-card">
      <span class="card-kicker">Money, folded in</span>
      <h2 class="rail-card__title">Bills asking today</h2>
      ${dueBills.length
        ? `<ul class="plan-bills">${dueBills
            .map(
              (b) => `<li>
                <span class="plan-bills__icon">${icon(b.icon || 'receipt', 15)}</span>
                <span class="plan-bills__name">${esc(b.name)}<small>${diffDays(state.date, b.nextDue) < 0 ? 'overdue' : 'due today'}</small></span>
                <strong>${money(b.amount)}</strong>
              </li>`
            )
            .join('')}</ul>
          <a class="rail-link" href="#/bills">${icon('receipt', 14)} Open bills ${icon('arrow-right', 13)}</a>`
        : `<p class="rail-card__sub">No bills are due today. Nothing to fold in — the hours stay for you.</p>`}
    </section>

    <section class="card rail-card rail-card--puffy rail-card--pip">
      ${pip({ mood, size: 76 })}
      <div>
        <span class="card-kicker">Puffy says</span>
        <p class="rail-puffy rail-pip">${pipLine}</p>
      </div>
    </section>`;
}

/* ------------------------------------------------------------------ paint */

function paint() {
  const root = document.getElementById('main');
  if (!root?.querySelector('.planner-page')) return;
  root.querySelector('[data-planner-actions]').innerHTML = actionsMarkup();
  root.querySelector('[data-plan-head]').innerHTML = planHeadMarkup();
  root.querySelector('[data-plan-stats]').innerHTML = statsMarkup();
  root.querySelector('[data-plan-body]').innerHTML = bodyMarkup();
  root.querySelector('[data-planner-rail]').innerHTML = railMarkup();
}

async function loadDay(date, { generate = false } = {}) {
  state.date = date;
  state.loading = true;
  state.plan = null;
  paint();
  try {
    const [profile, tasks, bills, checkin] = await Promise.all([
      getProfile(),
      getTasks({ includeDone: false }),
      getBills(),
      getCheckin(date),
    ]);
    state.profile = profile || {};
    state.tasks = tasks;
    state.bills = bills;
    state.checkin = checkin;
    if (profile?.plannerWeights) {
      state.weights = {
        urgency: Number(profile.plannerWeights.urgency ?? DEFAULT_WEIGHTS.urgency),
        importance: Number(profile.plannerWeights.importance ?? DEFAULT_WEIGHTS.importance),
        effort: Number(profile.plannerWeights.effort ?? DEFAULT_WEIGHTS.effort),
      };
    }
    const plan =
      generate || date === todayISO() ? await getOrCreatePlan(date) : await getPlan(date);
    state.plan = plan || null;
    document.querySelectorAll('[data-day-weekday]').forEach((el) => (el.textContent = formatDate(date, 'weekday-long')));
    document.querySelectorAll('[data-day-date]').forEach((el) => (el.textContent = formatDate(date, 'short')));
  } catch (err) {
    console.error(err);
    toast('Could not read the day. Try again.', { type: 'error' });
    state.plan = null;
  } finally {
    state.loading = false;
    paint();
  }
}

async function regenerate(weights = null) {
  state.busy = true;
  paint();
  try {
    const plan = await generatePlan(state.date, { weights: weights || state.weights });
    state.plan = plan;
    state.tasks = await getTasks({ includeDone: false });
    toast('A fresh plan. Same day, new shape.', { type: 'success' });
  } catch (err) {
    console.error(err);
    toast('The plan would not draw. Try once more.', { type: 'error' });
  } finally {
    state.busy = false;
    paint();
  }
}

function reflow(blocks) {
  if (!blocks.length) return blocks;
  let cursor = timeToMinutes(blocks[0].startTime || state.profile.workStart || '09:00');
  return blocks.map((block) => {
    const minutes =
      Number(block.minutes) ||
      Math.max(5, timeToMinutes(block.endTime) - timeToMinutes(block.startTime));
    const start = cursor;
    const end = start + minutes;
    cursor = end;
    const startTime = clock24(start);
    const endTime = clock24(end);
    return {
      ...block,
      minutes,
      startTime,
      endTime,
      start: `${state.date}T${startTime}`,
      end: `${state.date}T${endTime}`,
    };
  });
}

async function reorderPlan(sourceId, targetId) {
  if (!state.plan || sourceId === targetId) return;
  const blocks = state.plan.blocks.slice();
  const from = blocks.findIndex((b) => b.id === sourceId);
  const to = blocks.findIndex((b) => b.id === targetId);
  if (from < 0 || to < 0) return;
  const [moved] = blocks.splice(from, 1);
  const targetNow = blocks.findIndex((b) => b.id === targetId);
  blocks.splice(from < to ? targetNow + 1 : targetNow, 0, moved);
  const next = reflow(blocks);
  try {
    state.plan = await updatePlanBlocks(state.date, next);
    paint();
    toast('Moved. The times shifted to follow.', { type: 'info' });
  } catch (err) {
    console.error(err);
    toast('Could not move that block.', { type: 'error' });
  }
}

function stepBlock(blockId, direction) {
  if (!state.plan) return;
  const work = state.plan.blocks.filter((b) => b.kind !== 'break');
  const index = work.findIndex((b) => b.id === blockId);
  const neighbor = work[index + direction];
  if (!neighbor) return;
  reorderPlan(blockId, neighbor.id);
}

/* -------------------------------------------------------------------- page */

export default async function planner(root) {
  root.innerHTML = `
    <section class="planner-page">
      ${pageHead({
        eyebrow: 'Time, blocked gently',
        title: 'A plan you can <em>argue with</em>.',
        sub: 'Tasks and bills become time blocks with reasons. Regenerate, accept — or move a block and the hours follow.',
        actions: '<div class="planner-actions" data-planner-actions></div>',
      })}

      <div class="planner-layout">
        <section class="card plan-card" aria-label="Daily plan">
          <header class="plan-card__head" data-plan-head></header>
          <div class="plan-stats" data-plan-stats></div>
          <div class="plan-body" data-plan-body>
            <div class="plan-loading" aria-hidden="true">
              ${Array.from({ length: 5 }, () => '<div class="skeleton plan-skeleton"></div>').join('')}
            </div>
          </div>
        </section>
        <aside class="planner-rail" data-planner-rail aria-label="How the plan was made"></aside>
      </div>
    </section>
  `;

  await loadDay(todayISO());

  root.addEventListener('click', async (e) => {
    if (e.target.closest('[data-day-today]')) {
      e.preventDefault();
      loadDay(todayISO());
      return;
    }

    const dayBtn = e.target.closest('[data-day]');
    if (dayBtn) {
      dayBtn.disabled = true;
      await loadDay(addDays(state.date, Number(dayBtn.dataset.day)));
      return;
    }

    if (e.target.closest('[data-generate]')) {
      regenerate();
      return;
    }

    if (e.target.closest('[data-regenerate]')) {
      regenerate();
      return;
    }

    if (e.target.closest('[data-apply-weights]')) {
      const weights = { ...state.weights };
      regenerate(weights);
      return;
    }

    if (e.target.closest('[data-weight-reset]')) {
      state.weights = { ...DEFAULT_WEIGHTS };
      paint();
      toast('Weights reset to Puffy’s defaults.', { type: 'info' });
      return;
    }

    if (e.target.closest('[data-accept]')) {
      if (!state.plan) return;
      try {
        state.plan = await acceptPlan(state.date, state.plan.blocks);
        paint();
        toast('Plan accepted. The day has a shape.', { type: 'success' });
      } catch (err) {
        console.error(err);
        toast('Could not accept the plan.', { type: 'error' });
      }
      return;
    }

    if (e.target.closest('[data-reject]')) {
      if (!state.plan) return;
      try {
        state.plan = await rejectPlan(state.date);
        paint();
        toast('Set aside. No plan is a valid plan.', { type: 'info' });
      } catch (err) {
        console.error(err);
        toast('Could not set the plan aside.', { type: 'error' });
      }
      return;
    }

    const up = e.target.closest('[data-block-up]');
    if (up) {
      const host = up.closest('.plan-block');
      stepBlock(host.dataset.block, -1);
      return;
    }
    const down = e.target.closest('[data-block-down]');
    if (down) {
      const host = down.closest('.plan-block');
      stepBlock(host.dataset.block, 1);
    }
  });

  root.addEventListener('input', (e) => {
    const range = e.target.closest('[data-weight]');
    if (!range) return;
    const key = range.dataset.weight;
    const value = Number(range.value) / 100;
    state.weights = { ...state.weights, [key]: value };
    const out = root.querySelector(`[data-weight-out="${key}"]`);
    if (out) out.textContent = `${range.value}%`;
  });

  /* ---- drag reorder ------------------------------------------------------ */
  let dragId = null;
  const timelineHost = root.querySelector('[data-plan-body]');
  timelineHost.addEventListener('dragstart', (e) => {
    const block = e.target.closest('.plan-block[data-block]');
    if (!block) return;
    dragId = block.dataset.block;
    block.classList.add('is-dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragId);
  });
  timelineHost.addEventListener('dragover', (e) => {
    if (!dragId) return;
    const block = e.target.closest('.plan-block[data-block]');
    if (!block || block.dataset.block === dragId) return;
    e.preventDefault();
    timelineHost.querySelectorAll('.is-drop-target').forEach((el) => el.classList.remove('is-drop-target'));
    block.classList.add('is-drop-target');
  });
  timelineHost.addEventListener('drop', (e) => {
    if (!dragId) return;
    const block = e.target.closest('.plan-block[data-block]');
    e.preventDefault();
    timelineHost.querySelectorAll('.is-dragging, .is-drop-target').forEach((el) => {
      el.classList.remove('is-dragging', 'is-drop-target');
    });
    const source = dragId;
    dragId = null;
    if (block) reorderPlan(source, block.dataset.block);
  });
  timelineHost.addEventListener('dragend', () => {
    dragId = null;
    timelineHost.querySelectorAll('.is-dragging, .is-drop-target').forEach((el) => {
      el.classList.remove('is-dragging', 'is-drop-target');
    });
  });

  return {};
}
