import { icon } from '../icons.js';
import { pageHead, ring, bar, emptyState } from '../ui/widgets.js';
import { emptyTasks } from '../illustrations.js';
import { pip } from '../mascot.js';
import { openSheet, confirmSheet } from '../ui/sheet.js';
import { toast } from '../ui/toast.js';
import {
  TASK_CATEGORIES,
  PRIORITIES,
  categoryMeta,
  priorityMeta,
} from '../constants.js';
import {
  esc,
  todayISO,
  addDays,
  diffDays,
  relativeDue,
  minutesLabel,
  formatDate,
} from '../ui/format.js';
import {
  getTasks,
  saveTask,
  deleteTask,
  toggleTask,
  reorderTasks,
} from '../api.js';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'today', label: 'Today' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'done', label: 'Done' },
];

const SORTS = [
  { id: 'manual', label: 'My order' },
  { id: 'due', label: 'Deadline' },
  { id: 'priority', label: 'Priority' },
  { id: 'estimate', label: 'Quickest' },
];

const state = {
  tasks: [],
  filter: 'all',
  category: 'all',
  sort: 'manual',
  expanded: new Set(),
  dragging: null,
  pressedAt: 0,
};

let rootEl = null;
let listHost = null;
let swipe = null;

const today = () => todayISO();

const decorate = (task, ref = today()) => {
  const rel = relativeDue(task.due, ref);
  return {
    ...task,
    rel,
    cat: categoryMeta(task.category),
    pri: priorityMeta(task.priority),
    subs: task.subtasks || [],
    doneSubs: (task.subtasks || []).filter((s) => s.done).length,
    overdue: !task.done && Boolean(task.due) && diffDays(ref, task.due) < 0,
    dueToday: !task.done && task.due === ref,
  };
};

/* ------------------------------------------------------------------ stats */

function stats(tasks = state.tasks.map((t) => decorate(t))) {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  return {
    open: tasks.filter((t) => !t.done).length,
    overdue: tasks.filter((t) => t.overdue).length,
    dueToday: tasks.filter((t) => t.dueToday).length,
    doneWeek: tasks.filter(
      (t) => t.done && t.completedAt && new Date(t.completedAt) >= weekAgo
    ).length,
    doneToday: tasks.filter((t) => t.done && (t.completedAt || '').startsWith(today())).length,
  };
}

/* ------------------------------------------------------------------ markup */

function ledgerMarkup() {
  const s = stats();
  const cells = [
    { label: 'Open', value: s.open, note: 'on the list', tone: 'accent' },
    { label: 'Overdue', value: s.overdue, note: s.overdue ? 'needs the red pencil' : 'nothing slipped', tone: 'danger' },
    { label: 'Due today', value: s.dueToday, note: s.dueToday ? 'within reach' : 'a clear page', tone: 'ochre' },
    { label: 'Done this week', value: s.doneWeek, note: 'quiet progress', tone: 'sage' },
  ];
  return cells
    .map(
      (c) => `<div class="ledger-cell" data-ledger-cell="${c.tone}">
        <span class="ledger-cell__label"><span class="pill-dot ${c.value ? '' : 'pill-dot--hollow'}" aria-hidden="true"></span>${c.label}</span>
        <strong class="ledger-cell__value">${c.value}</strong>
        <span class="ledger-cell__note">${c.note}</span>
      </div>`
    )
    .join('');
}

function filtersMarkup() {
  return `<div class="segmented task-filters" role="group" aria-label="Filter tasks">
    ${FILTERS.map(
      (f) => `<button type="button" data-filter="${f.id}" aria-pressed="${f.id === state.filter}">
        ${f.label} <span class="seg-count" data-count="${f.id}">0</span>
      </button>`
    ).join('')}
  </div>`;
}

function catsMarkup() {
  const counts = {};
  state.tasks
    .filter((t) => !t.done)
    .forEach((t) => {
      counts[t.category] = (counts[t.category] || 0) + 1;
    });
  return `<button type="button" class="chip chip--sm" data-cat="all" aria-pressed="${state.category === 'all'}">All areas</button>
    ${TASK_CATEGORIES.filter((c) => counts[c.id]).map(
      (c) => `<button type="button" class="chip chip--sm" data-cat="${c.id}" aria-pressed="${state.category === c.id}">
        ${icon(c.icon, 13)} ${c.label} <span class="chip__count">${counts[c.id]}</span>
      </button>`
    ).join('')}`;
}

function taskRowMarkup(task, index, length) {
  const expanded = state.expanded.has(task.id);
  const hasDetail = Boolean(task.notes) || task.subs.length > 0;
  const manual = state.sort === 'manual';
  const subLine = task.subs.length
    ? `${task.doneSubs}/${task.subs.length} steps`
    : '';

  return `<li class="task-row ${task.done ? 'is-done' : ''} ${task.overdue ? 'is-overdue' : ''}"
      data-id="${task.id}" ${manual && !task.done ? 'draggable="true"' : ''}>
    <span class="task-grip" ${manual ? '' : 'hidden'} aria-hidden="true">${icon('grip', 16)}</span>
    <button class="task-check" type="button" role="checkbox" aria-checked="${task.done}"
      data-check aria-label="${task.done ? 'Mark not done' : 'Mark done'}: ${esc(task.title)}">
      ${task.done ? icon('check', 13) : ''}
    </button>
    <div class="task-body">
      <button type="button" class="task-title" data-edit>${esc(task.title)}</button>
      <div class="task-meta">
        <span class="task-cat tone--${task.cat.tone}">${icon(task.cat.icon, 12)} ${task.cat.label}</span>
        ${task.due ? `<span class="task-due" data-tone="${task.rel.tone}">${icon('calendar', 12)} ${task.rel.label}</span>` : '<span class="task-due" data-tone="none">No deadline</span>'}
        <span class="task-est">${icon('clock', 12)} ${minutesLabel(task.estimate)}</span>
        ${task.priority === 'high' && !task.done ? `<span class="task-flag">${icon('flag', 12)} High</span>` : ''}
        ${task.done && task.completedAt ? `<span class="task-done-at">Completed ${relativeDone(task.completedAt)}</span>` : ''}
      </div>
      ${hasDetail ? `<button type="button" class="task-expand" data-expand aria-expanded="${expanded}">
        ${icon(expanded ? 'chevron-up' : 'chevron-down', 13)}
        ${subLine || 'Details'}
        ${task.notes && task.subs.length ? '<span class="task-expand__dot" aria-hidden="true">·</span> note' : ''}
      </button>` : ''}
      <div class="task-extra" ${expanded ? '' : 'hidden'}>
        ${task.notes ? `<p class="task-notes">${esc(task.notes)}</p>` : ''}
        ${task.subs.length ? `<ul class="subtasks">${task.subs
          .map(
            (s) => `<li>
              <button type="button" class="subtask-check" data-subtask="${s.id}" aria-pressed="${s.done}" aria-label="${s.done ? 'Uncheck' : 'Check'} ${esc(s.title)}">
                ${icon(s.done ? 'check' : 'plus', 11)}
              </button>
              <span class="${s.done ? 'is-done' : ''}">${esc(s.title)}</span>
            </li>`
          )
          .join('')}</ul>` : ''}
        <button type="button" class="linkish" data-edit>Edit the details ${icon('arrow-right', 13)}</button>
      </div>
    </div>
    <details class="row-menu">
      <summary class="icon-btn task-more" aria-label="Actions for ${esc(task.title)}">${icon('more', 18)}</summary>
      <div class="menu menu--right">
        <button type="button" data-act="edit">${icon('edit', 15)} Edit</button>
        <button type="button" data-act="up" ${index === 0 ? 'disabled' : ''}>${icon('chevron-up', 15)} Move up</button>
        <button type="button" data-act="down" ${index === length - 1 ? 'disabled' : ''}>${icon('chevron-down', 15)} Move down</button>
        <hr />
        <button type="button" class="menu__danger" data-act="delete">${icon('trash', 15)} Delete</button>
      </div>
    </details>
  </li>`;
}

function relativeDone(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'recently';
  const days = diffDays(today(), iso.slice(0, 10));
  if (days === 0) return 'today';
  if (days === -1) return 'yesterday';
  if (days > -7) return `${-days} days ago`;
  return formatDate(iso.slice(0, 10), 'short');
}

function visibleTasks(decorated = state.tasks.map((t) => decorate(t))) {
  let list = decorated.slice();
  if (state.category !== 'all') list = list.filter((t) => t.category === state.category);

  if (state.filter === 'today') list = list.filter((t) => t.dueToday);
  else if (state.filter === 'overdue') list = list.filter((t) => t.overdue);
  else if (state.filter === 'done') list = list.filter((t) => t.done);

  const cmp = {
    due: (a, b) => (a.due || '9999').localeCompare(b.due || '9999'),
    priority: (a, b) => b.pri.rank - a.pri.rank || (a.due || '9999').localeCompare(b.due || '9999'),
    estimate: (a, b) => (a.estimate || 0) - (b.estimate || 0),
    manual: (a, b) => (a.order ?? 0) - (b.order ?? 0),
  }[state.sort];

  list.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return cmp(a, b);
  });
  return list;
}

function groupFor(filtered) {
  if (state.filter !== 'all') {
    const title = FILTERS.find((f) => f.id === state.filter)?.label || 'Tasks';
    return [{ id: state.filter, title, items: filtered, fold: false }];
  }
  const work = filtered.filter((t) => !t.done);
  const done = filtered.filter((t) => t.done);
  return [
    { id: 'overdue', title: 'Overdue', note: 'the red pencil', items: work.filter((t) => t.overdue), urgent: true },
    { id: 'today', title: 'Today', note: 'the page you are on', items: work.filter((t) => t.dueToday) },
    { id: 'week', title: 'Next seven days', note: 'room to breathe', items: work.filter((t) => t.due && diffDays(today(), t.due) > 0 && diffDays(today(), t.due) <= 7) },
    { id: 'later', title: 'Later', note: 'still on the map', items: work.filter((t) => t.due && diffDays(today(), t.due) > 7) },
    { id: 'someday', title: 'Someday', note: 'no deadline, no guilt', items: work.filter((t) => !t.due) },
    { id: 'done', title: 'Done', note: 'already carried', items: done, fold: true },
  ].filter((g) => g.items.length);
}

function listMarkup() {
  if (!state.tasks.length) {
    return emptyState({
      illustration: emptyTasks(),
      title: 'A blank page, in the good way.',
      text: 'Add the first thing — even a small one. Puffy will fold it into the day.',
      action: `<button class="btn btn--primary" type="button" data-new>${icon('plus', 16)} Add a task</button>`,
    });
  }

  const decorated = state.tasks.map((t) => decorate(t));
  const filtered = visibleTasks(decorated);
  if (!filtered.length) {
    const copy = {
      today: 'Nothing due today. The page is yours.',
      overdue: 'Nothing overdue. The red pencil stays in the drawer.',
      done: 'Nothing finished yet. The first tick is the hardest.',
      all: 'No tasks match this corner of the ledger.',
    }[state.filter];
    return emptyState({
      illustration: emptyTasks(),
      title: state.category !== 'all' ? 'Quiet in this area.' : 'Clear here.',
      text: copy,
      action: `<button class="btn btn--secondary" type="button" data-reset-filters>Show everything</button>`,
    });
  }

  const groups = groupFor(filtered);
  return groups
    .map((group) => {
      const rows = group.items
        .map((task, i) => taskRowMarkup(task, i, group.items.length))
        .join('');
      if (group.fold) {
        return `<details class="task-group task-group--done">
          <summary class="task-group__head">
            ${icon('chevron-right', 14)}
            <h2>${group.title}</h2>
            <span class="task-group__count">${group.items.length}</span>
            <span class="task-group__note">${group.note}</span>
          </summary>
          <ul class="task-list">${rows}</ul>
        </details>`;
      }
      return `<section class="task-group ${group.urgent ? 'task-group--urgent' : ''}">
        <div class="task-group__head">
          <h2>${group.title}</h2>
          <span class="task-group__count">${group.items.length}</span>
          <span class="task-group__note">${group.note}</span>
        </div>
        <ul class="task-list">${rows}</ul>
      </section>`;
    })
    .join('');
}

function railMarkup() {
  const decorated = state.tasks.map((t) => decorate(t));
  const s = stats(decorated);
  const target = s.doneToday + s.dueToday;
  const pct = target ? Math.round((s.doneToday / target) * 100) : 0;

  const openByCat = {};
  decorated
    .filter((t) => !t.done)
    .forEach((t) => {
      openByCat[t.category] = (openByCat[t.category] || 0) + 1;
    });
  const areas = Object.entries(openByCat)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const maxArea = areas[0]?.[1] || 1;

  const nudge = s.overdue
    ? `Start with the smallest overdue thing. ${s.overdue === 1 ? 'It is' : `${s.overdue} are`} only loud until you begin.`
    : s.dueToday
      ? `${s.dueToday} ${s.dueToday === 1 ? 'thing is' : 'things are'} due today. Tick the shortest first — momentum is real.`
      : s.open
        ? 'Nothing is on fire. Pick the one you would be relieved to finish.'
        : 'The list is empty. That is not laziness — that is a finished page.';

  return `<section class="card rail-card rail-card--today">
      <span class="card-kicker">Today’s page</span>
      <div class="rail-today">
        ${ring({ value: pct, size: 88, stroke: 6, label: `${s.doneToday}`, sub: 'done' })}
        <div class="rail-today__text">
          <strong>${s.dueToday ? `${Math.max(0, s.dueToday - s.doneToday)} left` : 'Nothing due'}</strong>
          <p>${s.dueToday ? 'due today, plus anything you choose to pull forward.' : 'You can pull a later task into today, or leave the page alone.'}</p>
        </div>
      </div>
      <a class="rail-link" href="#/planner">${icon('calendar', 15)} Fold these into a plan ${icon('arrow-right', 14)}</a>
    </section>

    <section class="card rail-card">
      <span class="card-kicker">Where it sits</span>
      <h2 class="rail-card__title">Open by area</h2>
      ${areas.length
        ? `<ul class="area-list">${areas
            .map(
              ([id, count]) => `<li>
                <span class="area-list__label">${icon(categoryMeta(id).icon, 14)} ${esc(categoryMeta(id).label)}</span>
                <span class="area-list__count">${count}</span>
                ${bar((count / maxArea) * 100, { thin: true, label: `${categoryMeta(id).label}: ${count} open` })}
              </li>`
            )
            .join('')}</ul>`
        : '<p class="tiny muted">Nothing open. The ledger is balanced.</p>'}
    </section>

    <section class="card rail-card rail-card--puffy rail-card--pip">
      ${pip({ mood: s.overdue ? 'worried' : s.dueToday ? 'thinking' : 'happy', size: 78 })}
      <div>
        <span class="card-kicker">Puffy says</span>
        <p class="rail-puffy rail-pip">${nudge}</p>
      </div>
    </section>`;
}

function paint() {
  if (!rootEl) return;
  const s = stats();
  const counts = {
    all: state.tasks.length,
    today: s.dueToday,
    overdue: s.overdue,
    done: state.tasks.filter((t) => t.done).length,
  };
  rootEl.querySelector('[data-ledger]').innerHTML = ledgerMarkup();
  rootEl.querySelectorAll('[data-count]').forEach((el) => {
    el.textContent = counts[el.dataset.count] ?? 0;
  });
  rootEl.querySelectorAll('[data-filter]').forEach((el) => {
    el.setAttribute('aria-pressed', el.dataset.filter === state.filter);
  });
  rootEl.querySelector('[data-cats]').innerHTML = catsMarkup();
  rootEl.querySelector('[data-list]').innerHTML = listMarkup();
  rootEl.querySelector('[data-rail]').innerHTML = railMarkup();
}

async function reload() {
  state.tasks = await getTasks();
  paint();
}

/* ------------------------------------------------------------------ editor */

function openEditor(task = null) {
  const editing = Boolean(task);
  const subs = (task?.subtasks || []).map((s) => ({ ...s }));
  let priority = task?.priority || 'medium';

  const subRow = (item = {}) => `<div class="sub-edit" data-done="${Boolean(item.done)}">
    <span class="sub-edit__dot" aria-hidden="true"></span>
    <input class="input" type="text" value="${esc(item.title || '')}" placeholder="One small step" aria-label="Subtask" />
    <button type="button" class="icon-btn" data-sub-remove aria-label="Remove subtask">${icon('close', 14)}</button>
  </div>`;

  const sheet = openSheet({
    eyebrow: editing ? 'Edit task' : 'New task',
    title: editing ? 'Change the shape of it.' : 'What needs carrying?',
    subtitle: editing
      ? 'Small edits are allowed. Nothing here is permanent.'
      : 'A title is enough. The rest can wait until later.',
    body: `
      <form class="task-form" data-task-form novalidate>
        <div class="field">
          <label for="task-title">Task</label>
          <input class="input" id="task-title" name="title" type="text" required autocomplete="off"
            placeholder="e.g. Email the landlord" value="${esc(task?.title || '')}" />
          <p class="field__error" data-error hidden></p>
        </div>
        <div class="field-row">
          <div class="field">
            <label for="task-category">Area</label>
            <div class="select-wrap">
              <select class="select" id="task-category" name="category">
                ${TASK_CATEGORIES.map(
                  (c) => `<option value="${c.id}" ${task?.category === c.id ? 'selected' : ''}>${c.label}</option>`
                ).join('')}
              </select>
              ${icon('chevron-down', 15)}
            </div>
          </div>
          <div class="field">
            <label for="task-due">Deadline</label>
            <input class="input" id="task-due" name="due" type="date" value="${task?.due || ''}" />
          </div>
        </div>
        <div class="quick-row" data-due-quick-row>
          <button type="button" class="chip chip--sm" data-due-quick="${today()}">Today</button>
          <button type="button" class="chip chip--sm" data-due-quick="${addDays(today(), 1)}">Tomorrow</button>
          <button type="button" class="chip chip--sm" data-due-quick="${addDays(today(), 7)}">In a week</button>
          <button type="button" class="chip chip--sm" data-due-quick="">No date</button>
        </div>
        <div class="field">
          <span class="field__label" id="priority-label">Priority</span>
          <div class="priority-pick" data-priority-pick role="group" aria-labelledby="priority-label">
            ${PRIORITIES.map(
              (p) => `<button type="button" class="chip" data-priority="${p.id}" aria-pressed="${p.id === priority}">
                <span class="pill-dot" data-tone="${p.id}" aria-hidden="true"></span>${p.label}
              </button>`
            ).join('')}
          </div>
          <p class="field__hint">Priority nudges the plan. It is not a moral judgement.</p>
        </div>
        <div class="field">
          <label for="task-estimate">How long?</label>
          <div class="input-group">
            <input class="input" id="task-estimate" name="estimate" type="number" inputmode="numeric"
              min="5" max="480" step="5" value="${Number(task?.estimate) || 30}" />
            <span class="input-group__suffix">minutes</span>
          </div>
          <div class="quick-row">
            ${[15, 30, 45, 60, 90].map(
              (m) => `<button type="button" class="chip chip--sm" data-est="${m}">${minutesLabel(m)}</button>`
            ).join('')}
          </div>
        </div>
        <div class="field">
          <label for="task-notes">Notes <span class="muted">(optional)</span></label>
          <textarea class="textarea" id="task-notes" name="notes" rows="3"
            placeholder="Context, links, the thing you will forget…">${esc(task?.notes || '')}</textarea>
        </div>
        <div class="field">
          <span class="field__label">Small steps <span class="muted">(optional)</span></span>
          <div class="sub-edit-list" data-subs>${subs.map(subRow).join('')}</div>
          <button type="button" class="linkish" data-add-sub>${icon('plus', 14)} Add a step</button>
        </div>
      </form>
    `,
    footer: `
      ${editing ? `<button class="btn btn--danger" type="button" data-delete>${icon('trash', 15)} Delete</button>` : ''}
      <span class="grow"></span>
      <button class="btn btn--ghost" type="button" data-cancel>Cancel</button>
      <button class="btn btn--primary" type="button" data-save>${editing ? 'Save changes' : 'Add task'}</button>
    `,
  });

  const form = sheet.body.querySelector('[data-task-form]');
  const titleInput = form.querySelector('[name="title"]');
  const dueInput = form.querySelector('[name="due"]');
  const estimateInput = form.querySelector('[name="estimate"]');
  const error = form.querySelector('[data-error]');
  const subsHost = form.querySelector('[data-subs]');

  // The submit button lives in the footer, outside the form.
  const saveBtn = sheet.footer.querySelector('[data-save]');
  saveBtn.addEventListener('click', () => form.requestSubmit());

  sheet.footer.querySelector('[data-cancel]')?.addEventListener('click', sheet.close);

  form.querySelectorAll('[data-priority]').forEach((btn) => {
    btn.addEventListener('click', () => {
      priority = btn.dataset.priority;
      form.querySelectorAll('[data-priority]').forEach((b) => {
        b.setAttribute('aria-pressed', b === btn);
      });
    });
  });

  form.querySelectorAll('[data-due-quick]').forEach((btn) => {
    btn.addEventListener('click', () => {
      dueInput.value = btn.dataset.dueQuick;
    });
  });

  form.querySelectorAll('[data-est]').forEach((btn) => {
    btn.addEventListener('click', () => {
      estimateInput.value = btn.dataset.est;
    });
  });

  form.querySelector('[data-add-sub]').addEventListener('click', () => {
    subsHost.insertAdjacentHTML('beforeend', subRow());
    subsHost.lastElementChild.querySelector('input')?.focus();
  });

  subsHost.addEventListener('click', (e) => {
    const remove = e.target.closest('[data-sub-remove]');
    if (remove) {
      remove.closest('.sub-edit').remove();
      return;
    }
    const dot = e.target.closest('.sub-edit__dot');
    if (dot) {
      const row = dot.closest('.sub-edit');
      row.dataset.done = row.dataset.done === 'true' ? 'false' : 'true';
      row.classList.toggle('is-done', row.dataset.done === 'true');
    }
  });

  sheet.footer.querySelector('[data-delete]')?.addEventListener('click', async () => {
    const yes = await confirmSheet({
      title: 'Delete this task?',
      message: `“${esc(task.title)}” will leave the list. This cannot be undone.`,
      confirmLabel: 'Delete task',
    });
    if (!yes) return;
    await deleteTask(task.id);
    sheet.close();
    toast('Task deleted.', { type: 'info' });
    await reload();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = titleInput.value.trim();
    if (!title) {
      error.hidden = false;
      error.textContent = 'Give it a few words — “call Mum” is enough.';
      titleInput.focus();
      return;
    }
    error.hidden = true;
    saveBtn.disabled = true;

    const subtasks = [...subsHost.querySelectorAll('.sub-edit')]
      .map((row) => {
        const value = row.querySelector('input').value.trim();
        if (!value) return null;
        return { title: value, done: row.dataset.done === 'true' };
      })
      .filter(Boolean);

    try {
      await saveTask({
        ...(task || {}),
        title,
        notes: form.querySelector('[name="notes"]').value.trim(),
        category: form.querySelector('[name="category"]').value,
        priority,
        due: dueInput.value || null,
        estimate: Math.max(5, Math.min(480, Number(estimateInput.value) || 30)),
        subtasks,
        done: Boolean(task?.done),
      });
      sheet.close();
      toast(editing ? 'Task updated.' : 'Added to the list.', { type: 'success' });
      await reload();
    } catch (err) {
      saveBtn.disabled = false;
      error.hidden = false;
      error.textContent = 'That did not save. Try once more.';
      console.error(err);
    }
  });
}

/* ------------------------------------------------------------------ actions */

async function complete(id) {
  const row = listHost.querySelector(`.task-row[data-id="${id}"]`);
  if (row) row.classList.add('is-completing');
  await new Promise((resolve) => setTimeout(resolve, 180));
  try {
    const updated = await toggleTask(id);
    state.expanded.delete(id);
    await reload();
    toast(updated.done ? 'Done. One less thing.' : 'Back on the list.', {
      type: updated.done ? 'success' : 'info',
    });
  } catch (err) {
    console.error(err);
    toast('Could not update that task.', { type: 'error' });
  }
}

async function toggleSubtask(taskId, subId) {
  const task = state.tasks.find((t) => t.id === taskId);
  if (!task) return;
  const subtasks = (task.subtasks || []).map((s) =>
    s.id === subId ? { ...s, done: !s.done } : s
  );
  await saveTask({ ...task, subtasks });
  state.expanded.add(taskId);
  await reload();
}

async function moveTask(id, direction) {
  const index = state.tasks.findIndex((t) => t.id === id);
  const next = index + direction;
  if (index < 0 || next < 0 || next >= state.tasks.length) return;
  const copy = state.tasks.slice();
  [copy[index], copy[next]] = [copy[next], copy[index]];
  await reorderTasks(copy.map((t) => t.id));
  state.tasks = copy;
  state.sort = 'manual';
  const sortSelect = rootEl.querySelector('[data-sort]');
  if (sortSelect) sortSelect.value = 'manual';
  paint();
}

async function reorderAround(draggedId, targetId) {
  if (!draggedId || !targetId || draggedId === targetId) return;
  const copy = state.tasks.slice();
  const from = copy.findIndex((t) => t.id === draggedId);
  if (from < 0) return;
  const [moved] = copy.splice(from, 1);
  const to = copy.findIndex((t) => t.id === targetId);
  copy.splice(to < 0 ? copy.length : to, 0, moved);
  state.tasks = copy;
  paint();
  await reorderTasks(copy.map((t) => t.id));
  toast('Order saved.', { type: 'info' });
}

async function removeTask(task) {
  const yes = await confirmSheet({
    title: 'Delete this task?',
    message: `“${esc(task.title)}” will leave the list. This cannot be undone.`,
    confirmLabel: 'Delete task',
  });
  if (!yes) return;
  await deleteTask(task.id);
  toast('Task deleted.', { type: 'info' });
  await reload();
}

/* -------------------------------------------------------------------- page */

export default async function tasks(root) {
  rootEl = root;
  root.innerHTML = `
    <section class="tasks-page">
      ${pageHead({
        eyebrow: 'Everything you carry',
        title: 'The list, <em>honestly</em>.',
        sub: 'One page for work, home and the small things. Sorted by what actually needs you — not by noise.',
        actions: `
          <a class="btn btn--secondary" href="#/planner">${icon('calendar', 16)} Plan the day</a>
          <button class="btn btn--primary" type="button" data-new>${icon('plus', 16)} New task</button>
        `,
      })}

      <div class="task-ledger" data-ledger role="group" aria-label="Task summary"></div>

      <div class="tasks-layout">
        <section class="tasks-main" aria-label="Task list">
          <form class="quick-add" data-quick-add autocomplete="off">
            <span class="quick-add__icon" aria-hidden="true">${icon('plus', 17)}</span>
            <input class="quick-add__input" type="text" name="title" aria-label="Quick add a task"
              placeholder="Add a task — press Enter" />
            <button class="btn btn--sm btn--accent-soft" type="submit">Add</button>
          </form>

          <div class="task-tools">
            ${filtersMarkup()}
            <label class="sort-wrap">
              ${icon('filter', 14)}
              <span class="sr-only">Sort tasks</span>
              <select class="select select--sm" data-sort>
                ${SORTS.map((s) => `<option value="${s.id}" ${s.id === state.sort ? 'selected' : ''}>${s.label}</option>`).join('')}
              </select>
              ${icon('chevron-down', 13)}
            </label>
          </div>

          <div class="cat-chips" data-cats aria-label="Filter by area"></div>

          <div data-list>
            <div class="task-loading" aria-hidden="true">
              ${Array.from({ length: 4 }, () => '<div class="skeleton task-skeleton"></div>').join('')}
            </div>
          </div>
          <p class="swipe-hint">${icon('arrow-left', 13)} Swipe a task left to finish it. Or use the circle.</p>
        </section>

        <aside class="tasks-rail" data-rail aria-label="Task overview"></aside>
      </div>
    </section>
  `;

  listHost = root.querySelector('[data-list]');

  try {
    state.tasks = await getTasks();
  } catch (err) {
    console.error(err);
    listHost.innerHTML = `<div class="card"><h2>That page didn’t load.</h2><p class="muted">Your tasks are safe on this device. Reload to try again.</p></div>`;
    return {};
  }

  paint();

  root.addEventListener('click', async (e) => {
    const newBtn = e.target.closest('[data-new]');
    if (newBtn) {
      openEditor();
      return;
    }

    if (e.target.closest('[data-reset-filters]')) {
      state.filter = 'all';
      state.category = 'all';
      paint();
      return;
    }

    const filter = e.target.closest('[data-filter]');
    if (filter) {
      state.filter = filter.dataset.filter;
      paint();
      return;
    }

    const cat = e.target.closest('[data-cat]');
    if (cat) {
      state.category = cat.dataset.cat;
      paint();
      return;
    }

    const row = e.target.closest('.task-row');
    if (!row) {
      root.querySelectorAll('.row-menu[open]').forEach((d) => d.removeAttribute('open'));
      return;
    }
    const id = row.dataset.id;
    const task = state.tasks.find((t) => t.id === id);

    if (e.target.closest('[data-check]')) {
      if (Date.now() - state.pressedAt < 450) return;
      complete(id);
      return;
    }

    if (e.target.closest('[data-expand]')) {
      if (state.expanded.has(id)) state.expanded.delete(id);
      else state.expanded.add(id);
      paint();
      return;
    }

    const sub = e.target.closest('[data-subtask]');
    if (sub) {
      toggleSubtask(id, sub.dataset.subtask);
      return;
    }

    const act = e.target.closest('[data-act]');
    if (act) {
      row.querySelector('.row-menu')?.removeAttribute('open');
      const what = act.dataset.act;
      if (what === 'edit') openEditor(task);
      else if (what === 'delete') removeTask(task);
      else if (what === 'up') moveTask(id, -1);
      else if (what === 'down') moveTask(id, 1);
      return;
    }

    if (e.target.closest('[data-edit]')) {
      if (Date.now() - state.pressedAt < 450) return;
      openEditor(task);
    }
  });

  root.querySelector('[data-quick-add]').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = e.currentTarget.querySelector('input');
    const title = input.value.trim();
    if (!title) {
      input.focus();
      return;
    }
    const due =
      state.filter === 'today' ? today() : state.filter === 'overdue' ? addDays(today(), -1) : null;
    input.value = '';
    try {
      await saveTask({
        title,
        category: state.category !== 'all' ? state.category : 'personal',
        priority: 'medium',
        due,
        estimate: 30,
      });
      state.filter = 'all';
      await reload();
      toast(`“${title.length > 32 ? `${title.slice(0, 32)}…` : title}” added.`, { type: 'success' });
      input.focus();
    } catch (err) {
      console.error(err);
      toast('Could not add that task.', { type: 'error' });
    }
  });

  root.querySelector('[data-sort]').addEventListener('change', (e) => {
    state.sort = e.target.value;
    paint();
  });

  /* ---- drag reorder ------------------------------------------------------ */
  let dragId = null;
  listHost.addEventListener('dragstart', (e) => {
    const row = e.target.closest('.task-row');
    if (!row || row.getAttribute('draggable') !== 'true' || state.sort !== 'manual') {
      e.preventDefault();
      return;
    }
    dragId = row.dataset.id;
    state.dragging = dragId;
    row.classList.add('is-dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragId);
  });
  listHost.addEventListener('dragover', (e) => {
    if (!dragId) return;
    const row = e.target.closest('.task-row');
    if (!row || row.dataset.id === dragId) return;
    e.preventDefault();
    listHost.querySelectorAll('.is-drop-target').forEach((el) => el.classList.remove('is-drop-target'));
    row.classList.add('is-drop-target');
  });
  listHost.addEventListener('drop', (e) => {
    if (!dragId) return;
    const row = e.target.closest('.task-row');
    e.preventDefault();
    listHost.querySelectorAll('.is-dragging, .is-drop-target').forEach((el) => {
      el.classList.remove('is-dragging', 'is-drop-target');
    });
    const target = row?.dataset.id;
    const source = dragId;
    dragId = null;
    state.dragging = null;
    if (target) reorderAround(source, target);
  });
  listHost.addEventListener('dragend', () => {
    dragId = null;
    state.dragging = null;
    listHost.querySelectorAll('.is-dragging, .is-drop-target').forEach((el) => {
      el.classList.remove('is-dragging', 'is-drop-target');
    });
  });

  /* ---- swipe to complete ------------------------------------------------- */
  listHost.addEventListener(
    'touchstart',
    (e) => {
      if (e.touches.length !== 1) return;
      const row = e.target.closest('.task-row');
      if (!row || row.classList.contains('is-done')) return;
      if (e.target.closest('.row-menu, [data-check], .subtasks, .task-extra')) return;
      swipe = {
        row,
        id: row.dataset.id,
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        dx: 0,
        active: false,
      };
    },
    { passive: true }
  );

  listHost.addEventListener(
    'touchmove',
    (e) => {
      if (!swipe) return;
      const dx = e.touches[0].clientX - swipe.x;
      const dy = e.touches[0].clientY - swipe.y;
      if (!swipe.active) {
        if (Math.abs(dx) < 12 || Math.abs(dx) < Math.abs(dy) + 6) return;
        swipe.active = true;
        swipe.row.classList.add('is-swiping');
      }
      if (dx < 0) {
        e.preventDefault();
        swipe.dx = dx;
        swipe.row.style.transform = `translateX(${Math.max(dx, -96)}px)`;
        swipe.row.style.setProperty('--swipe-p', Math.min(1, Math.abs(dx) / 80));
      }
    },
    { passive: false }
  );

  const endSwipe = () => {
    if (!swipe) return;
    const { row, id, dx, active } = swipe;
    swipe = null;
    if (!active) return;
    row.classList.remove('is-swiping');
    row.style.transform = '';
    row.style.removeProperty('--swipe-p');
    state.pressedAt = Date.now();
    if (dx <= -64) complete(id);
  };
  listHost.addEventListener('touchend', endSwipe);
  listHost.addEventListener('touchcancel', endSwipe);

  return {
    destroy() {
      rootEl = null;
      listHost = null;
      swipe = null;
    },
  };
}
