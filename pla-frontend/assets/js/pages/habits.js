import {
  getHabits,
  saveHabit,
  toggleHabit,
  deleteHabit,
  getGoals,
  saveGoal,
  deleteGoal,
} from '../api.js';
import {
  habitBestStreak,
  habitStreak,
  habitWeekCount,
  goalPercent,
  clampPct,
} from '../analytics.js';
import {
  addDays,
  esc,
  formatDate,
  pct,
  startOfWeek,
  todayISO,
  weekDays,
} from '../ui/format.js';
import { bar, hydrateRings, pageHead, ring, sectionHead } from '../ui/widgets.js';
import { icon } from '../icons.js';
import { openSheet, confirmSheet } from '../ui/sheet.js';
import { toast, toastError } from '../ui/toast.js';
import { emptyHabits, emptyGoals } from '../illustrations.js';
import { pip } from '../mascot.js';

const ICON_CHOICES = [
  { icon: 'sun', tone: 'ochre', label: 'Morning sun' },
  { icon: 'leaf', tone: 'sage', label: 'Leaf' },
  { icon: 'sprout', tone: 'sage', label: 'Sprout' },
  { icon: 'book', tone: 'accent', label: 'Book' },
  { icon: 'heart', tone: 'rose', label: 'Heart' },
  { icon: 'droplet', tone: 'indigo', label: 'Water' },
];

const GOAL_UNITS = ['%', 'books', 'sessions', 'km', 'hours', 'pages', 'workouts'];

const iconMeta = (name) => ICON_CHOICES.find((c) => c.icon === name) || ICON_CHOICES[2];

const goalValue = (goal) => {
  const current = Number(goal.current) || 0;
  const target = Number(goal.target) || 1;
  const unit = goal.unit || '%';
  if (unit === '%') return `${current}% of ${target}%`;
  return `${current} / ${target} ${unit}`;
};

const goalRemaining = (goal) => {
  const left = Math.max(0, (Number(goal.target) || 0) - (Number(goal.current) || 0));
  if (!left) return 'Target reached';
  const unit = goal.unit || '%';
  if (unit === '%') return `${Math.round(left)}% to go`;
  return `${Number(left.toFixed(2))} ${unit} to go`;
};

export default async function habitsPage(root, ctx) {
  const today = todayISO();
  let state = {
    habits: [],
    goals: [],
    weekOffset: 0,
    live: '',
    focus: null,
  };
  let generation = 0;

  root.innerHTML = `<div class="page habits-page">
    <div class="page-loading" aria-busy="true">
      <div class="skeleton page-loading__head"></div>
      <div class="skeleton page-loading__ledger"></div>
      <div class="skeleton page-loading__row"></div>
      <div class="skeleton page-loading__row"></div>
      <div class="skeleton page-loading__row"></div>
      <span class="sr-only">Loading your habits and goals</span>
    </div>
  </div>`;

  try {
    [state.habits, state.goals] = await Promise.all([getHabits(), getGoals()]);
  } catch (err) {
    console.error(err);
    root.innerHTML = `<div class="page"><div class="card card--pad-lg">
      <span class="eyebrow">Small repetitions</span>
      <h2 style="margin:10px 0 8px">The garden didn’t load.</h2>
      <p class="muted small">The local database could not be read. Nothing has been lost — try reloading this page.</p>
      <button class="btn btn--primary" type="button" style="margin-top:16px" data-retry>Reload the page</button>
    </div></div>`;
    root.querySelector('[data-retry]')?.addEventListener('click', () => window.location.reload());
    return {};
  }

  const findHabit = (id) => state.habits.find((h) => h.id === id);
  const findGoal = (id) => state.goals.find((g) => g.id === id);

  const viewedWeek = () => weekDays(addDays(today, state.weekOffset * 7));

  function summary() {
    const days = viewedWeek();
    const weekStart = days[0];
    const doneToday = state.habits.filter((h) => h.log?.[today]).length;
    const weekChecks = state.habits.reduce((total, h) => total + habitWeekCount(h, weekStart), 0);
    const weekTargets = state.habits.reduce((total, h) => total + (Number(h.targetPerWeek) || 0), 0);
    const streaks = state.habits.map((h) => ({
      habit: h,
      streak: habitStreak(h, today),
      best: habitBestStreak(h),
    }));
    const longest = streaks.slice().sort((a, b) => b.streak - a.streak)[0] || null;
    const bestEver = streaks.slice().sort((a, b) => b.best - a.best)[0] || null;
    const avgGoal = state.goals.length
      ? Math.round(state.goals.reduce((total, g) => total + goalPercent(g), 0) / state.goals.length)
      : 0;
    return {
      days,
      weekStart,
      doneToday,
      weekChecks,
      weekTargets,
      weekPercent: weekTargets ? clampPct((weekChecks / weekTargets) * 100) : 0,
      longest,
      bestEver,
      avgGoal,
    };
  }

  function ledger(s) {
    const weekLabel = state.weekOffset === 0 ? 'This week' : 'That week';
    const weekNote = state.weekOffset === 0
      ? `${pct(s.weekPercent)} of the week’s slots`
      : `${formatDate(s.days[0], 'short')} – ${formatDate(s.days[6], 'short')}`;
    return `<section class="ledger habit-ledger" aria-label="Habits and goals summary">
      <div class="ledger-cell" data-ledger-cell="sage">
        <span class="ledger-cell__label"><span class="pill-dot"></span>Kept today</span>
        <strong class="ledger-cell__value">${s.doneToday}<span class="ledger-cell__of"> / ${state.habits.length}</span></strong>
        <span class="ledger-cell__note">${state.habits.length ? (s.doneToday === state.habits.length ? 'every row checked' : 'one check at a time') : 'nothing to tend yet'}</span>
      </div>
      <div class="ledger-cell" data-ledger-cell="accent">
        <span class="ledger-cell__label"><span class="pill-dot"></span>${weekLabel}</span>
        <strong class="ledger-cell__value">${s.weekChecks}<span class="ledger-cell__of"> / ${s.weekTargets}</span></strong>
        <span class="ledger-cell__note">${weekNote}</span>
      </div>
      <div class="ledger-cell" data-ledger-cell="ochre">
        <span class="ledger-cell__label"><span class="pill-dot"></span>Longest streak</span>
        <strong class="ledger-cell__value">${s.longest?.streak ? `${s.longest.streak} days` : '—'}</strong>
        <span class="ledger-cell__note">${s.longest?.streak ? esc(s.longest.habit.name) : 'a check-in starts it'}</span>
      </div>
      <div class="ledger-cell" data-ledger-cell="rose">
        <span class="ledger-cell__label"><span class="pill-dot"></span>Goals moving</span>
        <strong class="ledger-cell__value">${state.goals.length}</strong>
        <span class="ledger-cell__note">${state.goals.length ? `${s.avgGoal}% average progress` : 'give the year a direction'}</span>
      </div>
    </section>`;
  }

  function dayButton(habit, date) {
    const on = Boolean(habit.log?.[date]);
    const future = date > today;
    const isToday = date === today;
    const label = `${formatDate(date, 'long')}${isToday ? ' (today)' : ''}${
      on ? ' — kept' : future ? ' — not yet' : ' — not kept'
    }`;
    return `<button type="button" class="habit-day${on ? ' is-done' : ''}${isToday ? ' is-today' : ''}"
      data-habit="${habit.id}" data-date="${date}"
      aria-pressed="${on}" ${future ? 'disabled' : ''} aria-label="${esc(label)}"
      title="${esc(label)}">
      <span class="habit-day__dow" aria-hidden="true">${formatDate(date, 'weekday').slice(0, 1)}</span>
      <span class="habit-day__dot" aria-hidden="true">${
        on ? icon('check', 12) : `<span class="habit-day__num">${Number(date.slice(8))}</span>`
      }</span>
    </button>`;
  }

  function habitRow(habit, s) {
    const count = habitWeekCount(habit, s.weekStart);
    const target = Number(habit.targetPerWeek) || 1;
    const percent = clampPct((count / target) * 100);
    const streak = habitStreak(habit, today);
    const meta = iconMeta(habit.icon);
    return `<li class="habit-row" data-id="${habit.id}">
      <div class="habit-row__top">
        <span class="habit-row__icon tone tone--${habit.tone || meta.tone}" aria-hidden="true">${icon(habit.icon || meta.icon, 18)}</span>
        <div class="habit-row__text">
          <div class="habit-row__name-line">
            <h3>${esc(habit.name)}</h3>
            ${streak > 1 ? `<span class="habit-streak" title="${streak}-day streak">${icon('flame', 11)} ${streak}</span>` : ''}
          </div>
          <p class="habit-row__meta">${habit.cadence === 'daily' ? 'Every day' : `${target}× a week`} · ${count} of ${target} kept</p>
        </div>
        <details class="row-menu habit-row__menu">
          <summary class="icon-btn" aria-label="More options for ${esc(habit.name)}">${icon('more', 17)}</summary>
          <div class="menu menu--right">
            <button type="button" data-action="edit-habit">${icon('edit', 15)} Edit habit</button>
            <button type="button" class="menu__danger" data-action="delete-habit">${icon('trash', 15)} Delete</button>
          </div>
        </details>
      </div>
      <div class="habit-days" role="group" aria-label="${esc(habit.name)} check-ins">
        ${s.days.map((d) => dayButton(habit, d)).join('')}
      </div>
      <div class="habit-row__progress">
        <div class="habit-row__progress-line">
          <span class="tiny muted">${count}/${target}</span>
          ${percent >= 100 ? `<span class="tag tag--sage tag--xs">${icon('check', 10)} target</span>` : ''}
        </div>
        ${bar(percent, { thin: true, level: percent >= 100 ? 'sage' : '', label: `${habit.name}: ${count} of ${target} this week` })}
      </div>
    </li>`;
  }

  function habitBoard(s) {
    if (!state.habits.length) {
      return `<div class="card empty habit-empty">
        ${emptyHabits()}
        <h3>An empty patch of soil</h3>
        <p>Start with one thing you’d do anyway — a stretch, a glass of water, a page before bed. Puffy will keep the rows.</p>
        <button class="btn btn--primary" type="button" data-action="add-habit">${icon('plus', 15)} Plant a habit</button>
      </div>`;
    }
    const canNext = state.weekOffset < 0;
    return `<section class="card habit-board" aria-labelledby="habit-board-title">
      <div class="habit-board__head">
        <div>
          <span class="card-kicker">The week’s rows</span>
          <h2 id="habit-board-title">${state.weekOffset === 0 ? 'This week’s rhythm' : 'That week’s rhythm'}</h2>
          <p class="habit-board__range">${formatDate(s.days[0], 'short')} – ${formatDate(s.days[6], 'short')}</p>
        </div>
        <div class="habit-board__nav" role="group" aria-label="Change week">
          <button class="icon-btn icon-btn--bordered" type="button" data-week="-1" aria-label="Previous week">
            ${icon('chevron-left', 16)}
          </button>
          <button class="icon-btn icon-btn--bordered" type="button" data-week="1" aria-label="Next week" ${canNext ? '' : 'disabled'}>
            ${icon('chevron-right', 16)}
          </button>
        </div>
      </div>
      <ul class="habit-board__list">
        ${state.habits.map((h) => habitRow(h, s)).join('')}
      </ul>
      <p class="habit-board__hint">${icon('info', 13)} Missed a day? Tap it to backfill — the streak stays honest, not punishing.</p>
    </section>`;
  }

  function goalCard(goal) {
    const percent = goalPercent(goal);
    const due = goal.targetDate ? formatDate(goal.targetDate, 'short') : 'no date';
    return `<article class="goal-card" data-id="${goal.id}">
      <div class="goal-card__head">
        ${ring({ value: percent, size: 68, stroke: 6, label: `${Math.round(percent)}%`, labelClass: 'goal-card__ring' })}
        <div class="goal-card__title">
          <h3>${esc(goal.title)}</h3>
          <p>${goalValue(goal)}</p>
          <span class="goal-card__due">${icon('calendar', 11)} ${due}</span>
        </div>
        <details class="row-menu">
          <summary class="icon-btn" aria-label="More options for ${esc(goal.title)}">${icon('more', 17)}</summary>
          <div class="menu menu--right">
            <button type="button" data-action="edit-goal">${icon('edit', 15)} Edit goal</button>
            <button type="button" class="menu__danger" data-action="delete-goal">${icon('trash', 15)} Delete</button>
          </div>
        </details>
      </div>
      ${goal.note ? `<p class="goal-card__note">${esc(goal.note)}</p>` : ''}
      <div class="goal-card__foot">
        <span class="tiny muted">${goalRemaining(goal)}</span>
        <button class="btn btn--sm btn--secondary" type="button" data-action="log-goal">
          ${icon('plus', 13)} Log progress
        </button>
      </div>
    </article>`;
  }

  function goalsSection() {
    if (!state.goals.length) {
      return `<section class="goal-section">
        ${sectionHead({ title: 'Goals', note: 'the far end of the row' })}
        <div class="card empty goal-empty">
          ${emptyGoals()}
          <h3>Nothing staked yet</h3>
          <p>A goal is just a direction with a date on it. Add one, then log the small steps.</p>
          <button class="btn btn--primary" type="button" data-action="add-goal">${icon('target', 15)} Add a goal</button>
        </div>
      </section>`;
    }
    return `<section class="goal-section">
      ${sectionHead({ title: 'Goals', note: `${state.goals.length} in motion` })}
      <div class="goal-cards">
        ${state.goals.map((g) => goalCard(g)).join('')}
      </div>
    </section>`;
  }

  function rhythmCard(s) {
    const current = weekDays(today);
    const counts = current.map((d) => state.habits.filter((h) => h.log?.[d]).length);
    const peak = Math.max(1, ...counts);
    const busiest = counts.indexOf(Math.max(...counts));
    return `<section class="rail-card card rhythm-card">
      <div class="rail-card__head">
        <span class="card-kicker">Weekly rhythm</span>
        <span class="tiny muted">${counts.reduce((a, b) => a + b, 0)} checks</span>
      </div>
      <div class="rhythm-bars" role="img" aria-label="Check-ins per day this week: ${current
        .map((d, i) => `${formatDate(d, 'weekday')} ${counts[i]}`)
        .join(', ')}">
        ${current
          .map(
            (d, i) => `<span class="rhythm-bar${d === today ? ' is-today' : ''}">
              <span class="rhythm-bar__track"><span class="rhythm-bar__fill" style="--h:${Math.max(
                4,
                (counts[i] / peak) * 100
              )}%"></span></span>
              <span class="rhythm-bar__label">${formatDate(d, 'weekday').slice(0, 1)}</span>
            </span>`
          )
          .join('')}
      </div>
      <p class="tiny muted">${peak > 1 ? `Busiest on ${formatDate(current[busiest], 'weekday-long')} — build around what already works.` : 'A quiet week so far. One check-in is plenty to begin.'}</p>
    </section>`;
  }

  function rail(s) {
    const nearest = state.goals
      .slice()
      .sort((a, b) => goalPercent(b) - goalPercent(a))[0];
    const allDone = state.habits.length && s.doneToday === state.habits.length;
    const pipLine = !state.habits.length
      ? 'Pick the smallest habit you can imagine. The one that takes two minutes is the one that lasts.'
      : allDone
      ? 'Every row checked. That’s not a small thing — let it be enough for today.'
      : s.longest?.streak > 2
      ? `“${esc(s.longest.habit.name)}” is on a ${s.longest.streak}-day run. Keep the same cue and the same time.`
      : 'Habits are kept by the cue, not the willpower. Attach the next one to something you already do.';
    return `<aside class="habits-rail" aria-label="Habits at a glance">
      <section class="rail-card card rail-card--puffy rail-card--pip">
        ${pip({ mood: allDone ? 'celebrating' : state.habits.length ? 'happy' : 'thinking', size: 64 })}
        <div>
          <span class="card-kicker">Puffy says</span>
          <p class="rail-puffy rail-pip">${pipLine}</p>
        </div>
      </section>
      ${rhythmCard(s)}
      ${
        nearest
          ? `<section class="rail-card card">
              <div class="rail-card__head">
                <span class="card-kicker">Closest to the finish</span>
                <span class="tiny muted">${Math.round(goalPercent(nearest))}%</span>
              </div>
              <div class="goal-nearest">
                ${ring({ value: goalPercent(nearest), size: 76, stroke: 7, label: `${Math.round(goalPercent(nearest))}%` })}
                <div>
                  <p class="goal-nearest__title">${esc(nearest.title)}</p>
                  <p class="tiny muted">${goalRemaining(nearest)} · ${formatDate(nearest.targetDate, 'short')}</p>
                </div>
              </div>
              <a class="card-link" href="#/review">See the week ${icon('arrow-right', 13)}</a>
            </section>`
          : ''
      }
      ${
        s.bestEver?.best > 2
          ? `<section class="rail-card card rail-card--quiet">
              <span class="card-kicker">A quiet record</span>
              <p class="rail-puffy rail-pip" style="margin-top:8px">Best run so far: <strong>${s.bestEver.best} days</strong> — ${esc(s.bestEver.habit.name)}.</p>
            </section>`
          : ''
      }
    </aside>`;
  }

  function paint() {
    const s = summary();
    root.innerHTML = `<div class="page habits-page">
      ${pageHead({
        eyebrow: 'Small repetitions',
        title: 'Tend the garden.',
        sub: 'Habits are the quiet rows; goals are the stakes at the end. Check in when it fits — not to keep a number happy.',
        actions: `
          <button class="btn btn--ghost" type="button" data-action="add-goal">${icon('target', 16)} New goal</button>
          <button class="btn btn--primary" type="button" data-action="add-habit">${icon('plus', 16)} New habit</button>`,
      })}
      ${ledger(s)}
      <div class="habits-layout">
        <div class="habits-main">
          ${habitBoard(s)}
          ${goalsSection()}
        </div>
        ${rail(s)}
      </div>
      <p class="sr-only" role="status" aria-live="polite">${esc(state.live)}</p>
    </div>`;
    hydrateRings(root);
    if (state.focus) {
      const selector = `[data-habit="${state.focus.id}"][data-date="${state.focus.date}"]`;
      root.querySelector(selector)?.focus({ preventScroll: true });
      state.focus = null;
    }
  }

  async function refresh() {
    const token = ++generation;
    const [habits, goals] = await Promise.all([getHabits(), getGoals()]);
    if (token !== generation) return;
    state.habits = habits;
    state.goals = goals;
    paint();
  }

  function closeMenus() {
    root.querySelectorAll('details[open]').forEach((d) => d.removeAttribute('open'));
  }

  function openHabitEditor(habit = null) {
    const isEdit = Boolean(habit);
    const chosen = habit?.icon || 'sprout';
    const cadence = habit?.cadence || 'weekly';
    const target = Number(habit?.targetPerWeek) || 3;
    const sheet = openSheet({
      eyebrow: isEdit ? 'Edit a row' : 'A new row',
      title: isEdit ? 'Change a habit.' : 'Plant a habit.',
      subtitle: 'Small, repeatable, and attached to something you already do.',
      body: `<form id="habit-form" novalidate>
        <div class="field">
          <label for="habit-name">Habit</label>
          <input class="input" id="habit-name" name="name" required maxlength="60"
            value="${esc(habit?.name || '')}" placeholder="e.g. Stretch before coffee" autocomplete="off">
        </div>
        <div class="field" style="margin-top:14px">
          <span class="field__label" id="icon-label">Icon</span>
          <div class="icon-picker" role="group" aria-labelledby="icon-label">
            ${ICON_CHOICES.map(
              (c) => `<button type="button" class="icon-choice tone--${c.tone}" data-icon="${c.icon}"
                aria-pressed="${c.icon === chosen}" aria-label="${c.label}" title="${c.label}">${icon(c.icon, 18)}</button>`
            ).join('')}
          </div>
        </div>
        <div class="field-row" style="margin-top:14px">
          <div class="field">
            <span class="field__label">Rhythm</span>
            <div class="segmented" role="group" aria-label="Habit rhythm" data-cadence>
              <button type="button" data-cadence-value="daily" aria-pressed="${cadence === 'daily'}">Daily</button>
              <button type="button" data-cadence-value="weekly" aria-pressed="${cadence === 'weekly'}">Some days</button>
            </div>
          </div>
          <div class="field">
            <label for="habit-target">Target / week</label>
            <input class="input" id="habit-target" name="targetPerWeek" type="number" inputmode="numeric"
              min="1" max="7" step="1" value="${cadence === 'daily' ? 7 : target}" ${cadence === 'daily' ? 'disabled' : ''}>
          </div>
        </div>
        <p class="field__hint" data-habit-hint style="margin-top:10px">${
          cadence === 'daily'
            ? 'Seven good-faith days. A missed day is just a missed day.'
            : 'Pick two to six days a week — enough to matter, not so many it becomes a chore.'
        }</p>
      </form>`,
      footer: `
        ${isEdit ? `<button class="btn btn--danger" type="button" data-delete>${icon('trash', 15)} Delete</button>` : ''}
        <button class="btn btn--ghost" type="button" data-cancel>Cancel</button>
        <button class="btn btn--primary" type="button" data-save>${isEdit ? 'Save changes' : 'Plant it'}</button>`,
      initialFocus: '#habit-name',
    });

    const form = sheet.dialog.querySelector('#habit-form');
    const targetInput = sheet.dialog.querySelector('#habit-target');
    const hint = sheet.dialog.querySelector('[data-habit-hint]');
    const cadenceGroup = sheet.dialog.querySelector('[data-cadence]');

    sheet.dialog.querySelectorAll('[data-icon]').forEach((btn) => {
      btn.addEventListener('click', () => {
        sheet.dialog.querySelectorAll('[data-icon]').forEach((b) => b.setAttribute('aria-pressed', 'false'));
        btn.setAttribute('aria-pressed', 'true');
      });
    });

    cadenceGroup.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-cadence-value]');
      if (!btn) return;
      const value = btn.dataset.cadenceValue;
      cadenceGroup.querySelectorAll('[data-cadence-value]').forEach((b) =>
        b.setAttribute('aria-pressed', String(b.dataset.cadenceValue === value))
      );
      const daily = value === 'daily';
      targetInput.disabled = daily;
      if (daily) targetInput.value = '7';
      else if (Number(targetInput.value) >= 7) targetInput.value = '4';
      hint.textContent = daily
        ? 'Seven good-faith days. A missed day is just a missed day.'
        : 'Pick two to six days a week — enough to matter, not so many it becomes a chore.';
    });

    sheet.dialog.querySelector('[data-cancel]').addEventListener('click', sheet.close);
    sheet.dialog.querySelector('[data-save]').addEventListener('click', () => form.requestSubmit());
    sheet.dialog.querySelector('[data-delete]')?.addEventListener('click', async () => {
      sheet.close();
      const ok = await confirmSheet({
        title: 'Remove this habit?',
        message: `“${esc(habit.name)}” and its check-in history will be removed. No streak is harmed by starting again.`,
        confirmLabel: 'Remove habit',
      });
      if (!ok) return;
      await deleteHabit(habit.id);
      toast('Habit removed');
      await refresh();
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const name = String(data.get('name') || '').trim();
      if (!name) {
        toastError('Give the habit a name first');
        sheet.dialog.querySelector('#habit-name').focus();
        return;
      }
      const iconName = sheet.dialog.querySelector('[data-icon][aria-pressed="true"]')?.dataset.icon || 'sprout';
      const meta = iconMeta(iconName);
      const cadenceValue =
        sheet.dialog.querySelector('[data-cadence-value][aria-pressed="true"]')?.dataset.cadenceValue || 'weekly';
      const targetPerWeek = cadenceValue === 'daily' ? 7 : Number(data.get('targetPerWeek')) || 3;
      try {
        await saveHabit({
          id: habit?.id,
          name,
          icon: iconName,
          tone: meta.tone,
          cadence: cadenceValue,
          targetPerWeek,
          log: habit?.log || {},
        });
        sheet.close();
        toast(isEdit ? `${name} updated` : `${name} planted. One day at a time.`);
        await refresh();
      } catch (err) {
        console.error(err);
        toastError('That habit could not be saved');
      }
    });
  }

  function openGoalEditor(goal = null) {
    const isEdit = Boolean(goal);
    const unit = goal?.unit || '%';
    const units = GOAL_UNITS.includes(unit) ? GOAL_UNITS : [unit, ...GOAL_UNITS];
    const sheet = openSheet({
      eyebrow: isEdit ? 'Edit a goal' : 'A new goal',
      title: isEdit ? 'Change the stakes.' : 'Give it a direction.',
      subtitle: 'A number, a unit, and a date. You can always adjust the pace.',
      body: `<form id="goal-form" novalidate>
        <div class="field">
          <label for="goal-title">Goal</label>
          <input class="input" id="goal-title" name="title" required maxlength="80"
            value="${esc(goal?.title || '')}" placeholder="e.g. Read 12 books this year" autocomplete="off">
        </div>
        <div class="field-row" style="margin-top:14px">
          <div class="field">
            <label for="goal-current">Now</label>
            <input class="input" id="goal-current" name="current" type="number" inputmode="decimal"
              min="0" step="any" value="${goal ? goal.current : 0}">
          </div>
          <div class="field">
            <label for="goal-target">Target</label>
            <input class="input" id="goal-target" name="target" type="number" inputmode="decimal"
              min="0.1" step="any" required value="${goal ? goal.target : 10}">
          </div>
        </div>
        <div class="field-row" style="margin-top:14px">
          <div class="field">
            <label for="goal-unit">Unit</label>
            <div class="select-wrap">
              <select class="select" id="goal-unit" name="unit">
                ${units.map((u) => `<option value="${esc(u)}" ${u === unit ? 'selected' : ''}>${esc(u === '%' ? '% (percent)' : u)}</option>`).join('')}
              </select>
              ${icon('chevron-down', 15)}
            </div>
          </div>
          <div class="field">
            <label for="goal-date">By when</label>
            <input class="input" id="goal-date" name="targetDate" type="date"
              value="${goal?.targetDate || addDays(today, 30)}">
          </div>
        </div>
        <div class="field" style="margin-top:14px">
          <label for="goal-note">A note <span class="field__hint" style="font-weight:400">(optional)</span></label>
          <textarea class="textarea" id="goal-note" name="note" rows="2" maxlength="240"
            placeholder="What counts, what doesn’t, and why it matters…">${esc(goal?.note || '')}</textarea>
        </div>
      </form>`,
      footer: `
        ${isEdit ? `<button class="btn btn--danger" type="button" data-delete>${icon('trash', 15)} Delete</button>` : ''}
        <button class="btn btn--ghost" type="button" data-cancel>Cancel</button>
        <button class="btn btn--primary" type="button" data-save>${isEdit ? 'Save changes' : 'Add the goal'}</button>`,
      initialFocus: '#goal-title',
    });

    const form = sheet.dialog.querySelector('#goal-form');
    sheet.dialog.querySelector('[data-cancel]').addEventListener('click', sheet.close);
    sheet.dialog.querySelector('[data-save]').addEventListener('click', () => form.requestSubmit());
    sheet.dialog.querySelector('[data-delete]')?.addEventListener('click', async () => {
      sheet.close();
      const ok = await confirmSheet({
        title: 'Delete this goal?',
        message: `“${esc(goal.title)}” will be removed. The work you already did still counts.`,
        confirmLabel: 'Delete goal',
      });
      if (!ok) return;
      await deleteGoal(goal.id);
      toast('Goal removed');
      await refresh();
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const title = String(data.get('title') || '').trim();
      const target = Number(data.get('target'));
      if (!title) {
        toastError('Give the goal a title');
        sheet.dialog.querySelector('#goal-title').focus();
        return;
      }
      if (!Number.isFinite(target) || target <= 0) {
        toastError('Set a target above zero');
        sheet.dialog.querySelector('#goal-target').focus();
        return;
      }
      try {
        await saveGoal({
          id: goal?.id,
          title,
          note: String(data.get('note') || '').trim(),
          current: Math.max(0, Number(data.get('current')) || 0),
          target,
          unit: String(data.get('unit') || '%'),
          targetDate: String(data.get('targetDate') || addDays(today, 30)),
        });
        sheet.close();
        toast(isEdit ? `${title} updated` : `${title} added to the horizon.`);
        await refresh();
      } catch (err) {
        console.error(err);
        toastError('That goal could not be saved');
      }
    });
  }

  function openProgress(goal) {
    const unit = goal.unit || '%';
    const step = unit === '%' ? 1 : unit === 'km' || unit === 'hours' ? 0.5 : 1;
    const sheet = openSheet({
      eyebrow: 'A step forward',
      title: esc(goal.title),
      subtitle: `${goalValue(goal)} · ${formatDate(goal.targetDate, 'medium')}`,
      body: `<form id="progress-form" novalidate>
        <div class="field">
          <label for="progress-current">Where you are now</label>
          <div class="input-group">
            <input class="input" id="progress-current" name="current" type="number" inputmode="decimal"
              min="0" step="${step}" value="${Number(goal.current) || 0}">
            <span class="input-group__suffix">${esc(unit)}</span>
          </div>
        </div>
        <div class="progress-quick" role="group" aria-label="Quick add">
          <button type="button" class="chip" data-step="${step}">+${Number(step.toFixed(1))}</button>
          <button type="button" class="chip" data-step="${step * 2}">+${Number((step * 2).toFixed(1))}</button>
          <button type="button" class="chip" data-step="${step * 5}">+${Number((step * 5).toFixed(1))}</button>
          <button type="button" class="chip chip--ghost" data-complete>${icon('flag', 13)} Mark complete</button>
        </div>
        <p class="field__hint" style="margin-top:12px">Progress is a record, not a promise. Update it whenever it’s true.</p>
      </form>`,
      footer: `<button class="btn btn--ghost" type="button" data-cancel>Not yet</button>
        <button class="btn btn--primary" type="button" data-save>${icon('check', 15)} Save progress</button>`,
      initialFocus: '#progress-current',
    });
    const form = sheet.dialog.querySelector('#progress-form');
    const input = sheet.dialog.querySelector('#progress-current');
    const max = Number(goal.target) || 0;
    sheet.dialog.querySelectorAll('[data-step]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const next = (Number(input.value) || 0) + Number(btn.dataset.step);
        input.value = String(Math.min(max || next, Number(next.toFixed(2))));
        input.focus();
      });
    });
    sheet.dialog.querySelector('[data-complete]')?.addEventListener('click', () => {
      input.value = String(max);
      input.focus();
    });
    sheet.dialog.querySelector('[data-cancel]').addEventListener('click', sheet.close);
    sheet.dialog.querySelector('[data-save]').addEventListener('click', () => form.requestSubmit());

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      try {
        await saveGoal({ ...goal, current: Math.max(0, Number(input.value) || 0) });
        sheet.close();
        toast(Number(input.value) >= max ? `${goal.title} — done.` : 'Progress saved');
        await refresh();
      } catch (err) {
        console.error(err);
        toastError('That progress could not be saved');
      }
    });
  }

  async function chooseHabit(button) {
    const id = button.dataset.habit;
    const date = button.dataset.date;
    if (!id || !date || date > today) return;
    const habit = findHabit(id);
    if (!habit) return;
    button.disabled = true;
    try {
      const updated = await toggleHabit(id, date);
      state.habits = state.habits.map((h) => (h.id === id ? updated : h));
      state.live = `${habit.name} ${updated.log?.[date] ? 'kept' : 'unchecked'} for ${formatDate(date, 'long')}`;
      state.focus = { id, date };
      paint();
    } catch (err) {
      console.error(err);
      button.disabled = false;
      toastError('That check-in did not save. Try once more.');
    }
  }

  async function onClick(event) {
    const day = event.target.closest('[data-habit][data-date]');
    if (day && !day.disabled) {
      await chooseHabit(day);
      return;
    }

    const weekBtn = event.target.closest('[data-week]');
    if (weekBtn) {
      const delta = Number(weekBtn.dataset.week);
      const next = state.weekOffset + delta;
      if (next > 0) return;
      state.weekOffset = next;
      paint();
      return;
    }

    const actionEl = event.target.closest('[data-action]');
    if (!actionEl) return;
    const action = actionEl.dataset.action;
    const row = actionEl.closest('[data-id]');
    const habit = row ? findHabit(row.dataset.id) : null;
    const goal = row ? findGoal(row.dataset.id) : null;
    closeMenus();

    if (action === 'add-habit') return openHabitEditor();
    if (action === 'add-goal') return openGoalEditor();
    if (action === 'edit-habit' && habit) return openHabitEditor(habit);
    if (action === 'edit-goal' && goal) return openGoalEditor(goal);
    if (action === 'log-goal' && goal) return openProgress(goal);
    if (action === 'delete-habit' && habit) {
      const ok = await confirmSheet({
        title: 'Remove this habit?',
        message: `“${esc(habit.name)}” and its check-in history will be removed. No streak is harmed by starting again.`,
        confirmLabel: 'Remove habit',
      });
      if (!ok) return;
      await deleteHabit(habit.id);
      toast('Habit removed');
      return refresh();
    }
    if (action === 'delete-goal' && goal) {
      const ok = await confirmSheet({
        title: 'Delete this goal?',
        message: `“${esc(goal.title)}” will be removed. The work you already did still counts.`,
        confirmLabel: 'Delete goal',
      });
      if (!ok) return;
      await deleteGoal(goal.id);
      toast('Goal removed');
      return refresh();
    }
  }

  root.addEventListener('click', onClick);
  paint();

  return {
    destroy() {
      root.removeEventListener('click', onClick);
    },
  };
}
