import { icon } from '../icons.js';
import { pip } from '../mascot.js';
import {
  getProfile,
  getTasks,
  getBills,
  getOrCreatePlan,
  getCheckin,
  getCheckins,
  saveCheckin,
  getMoneyOverview,
  getHabits,
  toggleHabit,
  getGoals,
  getUnreadCount,
  generatePlan,
} from '../api.js';
import {
  greeting,
  todayISO,
  addDays,
  diffDays,
  monthKey,
  formatDate,
  minutesLabel,
  money,
  weekdayShort,
  relativeDue,
  timeFromMinutes,
  timeToMinutes,
  esc,
} from '../ui/format.js';
import { moodPicker, moodFace, moodMeta, ring, bar, hydrateRings } from '../ui/widgets.js';
import { habitSummary, budgetLevel, goalPercent } from '../analytics.js';
import { billKind, categoryMeta } from '../constants.js';

const clock = (hhmm) => timeFromMinutes(timeToMinutes(hhmm));

export default async function dashboard(root, ctx) {
  const today = todayISO();
  const g = greeting();

  root.innerHTML = `
    <div class="page dash-loading" aria-busy="true">
      <div class="skeleton dash-loading__hero"></div>
      <div class="dash-grid">
        <div class="skeleton dash-loading__card"></div>
        <div class="skeleton dash-loading__card"></div>
        <div class="skeleton dash-loading__card"></div>
      </div>
      <span class="visually-hidden">Loading your day</span>
    </div>`;

  let profile;
  let tasks;
  let bills;
  let plan;
  let checkin;
  let overview;
  let habits;
  let goals;
  let unread;
  let weekCheckins;

  try {
    [profile, tasks, bills, plan, checkin, overview, habits, goals, unread, weekCheckins] =
      await Promise.all([
        getProfile(),
        getTasks(),
        getBills(),
        getOrCreatePlan(today),
        getCheckin(today),
        getMoneyOverview(monthKey(today)),
        getHabits(),
        getGoals(),
        getUnreadCount(),
        getCheckins(addDays(today, -6), today),
      ]);
  } catch (err) {
    console.error(err);
    root.innerHTML = `<div class="page">
      <div class="card card--pad-lg">
        <span class="eyebrow">Today</span>
        <h2 style="margin:10px 0 8px">Your day didn’t load.</h2>
        <p class="muted small">The local database could not be read. Nothing has been lost — try reloading this page.</p>
        <button class="btn btn--primary" type="button" style="margin-top:16px" data-reload>Reload the page</button>
      </div>
    </div>`;
    root.querySelector('[data-reload]')?.addEventListener('click', () => window.location.reload());
    return {};
  }

  const state = {
    profile,
    tasks,
    bills,
    plan,
    checkin,
    overview,
    habits,
    goals,
    unread,
    weekCheckins,
    busyMood: false,
  };

  const firstName = (profile?.name || 'Maya').split(' ')[0];
  const openTasks = () => state.tasks.filter((t) => !t.done);
  const overdueTasks = () => openTasks().filter((t) => t.due && t.due < today);
  const dueTodayBills = () => state.bills.filter((b) => b.nextDue === today);

  function heroMood() {
    if (state.checkin?.mood && state.checkin.mood <= 2) return 'thinking';
    if (g.period === 'night') return 'sleepy';
    if (dueTodayBills().length) return 'thinking';
    if (overdueTasks().length) return 'worried';
    return 'happy';
  }

  function nudge() {
    if (state.checkin?.mood && state.checkin.mood <= 2) {
      return 'Low battery is information, not failure. I kept the day to three things.';
    }
    const due = dueTodayBills()[0];
    if (due) return `${due.name} is due today — ten minutes now saves a late fee later.`;
    const late = overdueTasks();
    if (late.length) {
      return `${late.length} thing${late.length === 1 ? '' : 's'} slipped past the date. The smallest one first?`;
    }
    if (state.plan?.blocks?.length) {
      return 'The day has a shape. One thing at a time — the breaks are part of it.';
    }
    return 'A blank page is allowed. Add one small thing, then stop.';
  }

  function heroChips() {
    const focus = state.plan?.stats?.focusMinutes || 0;
    const due = dueTodayBills();
    const late = overdueTasks();
    return [
      `<span class="hero-chip">${icon('clock', 13)} ${focus ? `${minutesLabel(focus)} planned` : 'No plan yet'}</span>`,
      due.length
        ? `<a class="hero-chip hero-chip--warn" href="#/bills">${icon('receipt', 13)} ${due.length} bill${due.length === 1 ? '' : 's'} due today</a>`
        : '',
      late.length
        ? `<a class="hero-chip hero-chip--danger" href="#/tasks">${icon('alert', 13)} ${late.length} overdue</a>`
        : '',
      state.unread
        ? `<a class="hero-chip" href="#/notifications">${icon('bell', 13)} ${state.unread} unread</a>`
        : '',
    ]
      .filter(Boolean)
      .join('');
  }

  function heroMarkup() {
    return `<section class="home-hero">
      <div class="home-hero__copy">
        <span class="eyebrow">${icon(g.period === 'night' ? 'moon' : 'sun', 12)} ${formatDate(today, 'long')}</span>
        <h1>${g.hello}, <em>${esc(firstName)}</em>.</h1>
        <p class="home-hero__sub">${g.line}</p>
        <div class="home-hero__chips" data-hero-chips>${heroChips()}</div>
        <div class="home-hero__actions">
          <a class="btn btn--primary" href="#/planner">${icon('calendar', 17)} Open today’s plan</a>
          <a class="btn btn--secondary" href="#/review">Look back on the week</a>
        </div>
      </div>
      <div class="home-hero__art">
        <span class="home-hero__halo" aria-hidden="true"></span>
        <div class="home-hero__pip" data-hero-puffy data-hero-pip>${pip({ mood: heroMood(), size: 184, float: true })}</div>
        <div class="home-hero__note">
          <span class="card-kicker">${icon('sparkles', 12)} Puffy says</span>
          <p data-hero-nudge>${esc(nudge())}</p>
        </div>
      </div>
    </section>`;
  }

  function weekMoodMarkup() {
    const byDate = new Map((state.weekCheckins || []).map((c) => [c.date, c]));
    return `<div class="mood-week">
      <span class="mood-week__label">This week</span>
      <div class="mood-week__days" aria-label="Mood check-ins this week">
        ${Array.from({ length: 7 }, (_, i) => {
          const date = addDays(today, i - 6);
          const entry = byDate.get(date);
          const meta = entry ? moodMeta(entry.mood) : null;
          return `<div class="mood-day ${date === today ? 'is-today' : ''}" data-mood-day="${date}" title="${formatDate(date, 'weekday')} · ${meta ? meta.label : 'No check-in'}">
            <span class="mood-day__week">${weekdayShort(date).slice(0, 1)}</span>
            <span class="mood-day__face">${entry ? moodFace(entry.mood, 18) : '<span class="mood-day__empty"></span>'}</span>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }

  function moodNoteText() {
    const level = state.checkin?.mood;
    if (!level) return 'Tap a face — it stays on this device.';
    const meta = moodMeta(level);
    const note = state.checkin?.note ? ` — “${esc(state.checkin.note)}”` : '';
    return `Checked in as ${meta.label}${note}. ${level <= 2 ? 'Puffy keeps the day light.' : 'Saved on this device.'}`;
  }

  function moodCardMarkup() {
    const selected = state.checkin?.mood || null;
    const meta = selected ? moodMeta(selected) : null;
    return `<section class="card mood-card">
      <div class="card-head">
        <div>
          <span class="card-kicker">Check-in</span>
          <h2>How’s the weather inside?</h2>
          <p class="card-head__sub">One tap. Puffy keeps the plan honest.</p>
        </div>
        <span class="tag tag--accent" data-mood-tag ${selected ? '' : 'hidden'}>${meta ? meta.label : ''}</span>
      </div>
      ${moodPicker(selected, { name: 'dashboard-mood', attr: 'data-dash-mood' })}
      <p class="mood-card__note" data-mood-note>${moodNoteText()}</p>
      ${weekMoodMarkup()}
    </section>`;
  }

  function timelineItem(block) {
    if (block.kind === 'break') {
      return `<li class="timeline__item timeline__item--break">
        <span class="timeline__time">${clock(block.startTime)}</span>
        <span class="timeline__rail"><span class="timeline__dot" aria-hidden="true"></span></span>
        <span class="timeline__body"><span class="timeline__break">${esc(block.title)} <span class="muted">· ${esc(block.reason)}</span></span></span>
      </li>`;
    }
    const task = state.tasks.find((t) => t.id === block.taskId);
    const bill = state.bills.find((b) => b.id === block.billId);
    const cat = categoryMeta(task?.category);
    const kind = billKind(bill?.kind);
    const blockIcon = block.kind === 'bill' ? kind.icon : cat.icon;
    return `<li class="timeline__item timeline__item--${block.kind}">
      <span class="timeline__time">${clock(block.startTime)}</span>
      <span class="timeline__rail"><span class="timeline__dot">${icon(blockIcon, 13)}</span></span>
      <div class="timeline__body">
        <div class="timeline__title-row">
          <strong class="timeline__title">${esc(block.title)}</strong>
          ${block.kind === 'bill' ? `<span class="timeline__amount">${money(bill?.amount || 0)}</span>` : ''}
        </div>
        <p class="timeline__reason">${esc(block.reason)}</p>
        <div class="timeline__meta">
          <span class="tag">${block.kind === 'bill' ? 'Bill' : cat.label}</span>
          <span>${block.minutes} min</span>
          ${block.kind === 'task' && task?.priority === 'high' ? `<span class="timeline__priority">${icon('flag', 10)} High</span>` : ''}
        </div>
      </div>
    </li>`;
  }

  function planCardInner() {
    const blocks = state.plan?.blocks || [];
    const shown = blocks.slice(0, 5);
    const rest = blocks.length - shown.length;
    const stats = state.plan?.stats || {};
    const accepted = state.plan?.status === 'accepted';

    return `<div class="card-head">
        <div>
          <span class="card-kicker">Today</span>
          <h2>The shape of your day</h2>
          <p class="card-head__sub">${
            stats.focusMinutes
              ? `${minutesLabel(stats.focusMinutes)} of focus, ${stats.breakBlocks || 0} gentle break${stats.breakBlocks === 1 ? '' : 's'}`
              : 'No blocks placed yet.'
          }</p>
        </div>
        <a class="card-link" href="#/planner">Open plan ${icon('chevron-right', 13)}</a>
      </div>
      ${
        blocks.length
          ? `<ol class="timeline">${shown.map(timelineItem).join('')}</ol>`
          : `<div class="plan-empty">
              <span class="plan-empty__pip" aria-hidden="true">${pip({ mood: 'thinking', size: 62 })}</span>
              <span><strong>Nothing placed yet</strong><span class="tiny muted"> Shape a gentle day in the planner.</span></span>
              <a class="btn btn--secondary btn--sm" href="#/planner">Shape it</a>
            </div>`
      }
      <div class="plan-card__foot">
        <span class="tiny muted">${rest > 0 ? `+${rest} more block${rest === 1 ? '' : 's'}` : 'The rest of the day is yours.'}</span>
        <span class="tag ${accepted ? 'tag--sage' : ''}">${accepted ? 'Accepted' : 'Draft'}</span>
      </div>`;
  }

  function billsCardMarkup() {
    const upcoming = state.bills.filter((b) => b.nextDue).slice(0, 3);
    const total30 = state.bills
      .filter((b) => {
        const days = diffDays(today, b.nextDue);
        return days >= 0 && days <= 30;
      })
      .reduce((sum, b) => sum + Number(b.amount || 0), 0);

    return `<div class="card-head">
        <div>
          <span class="card-kicker">Money</span>
          <h2>Coming up</h2>
        </div>
        <a class="card-link" href="#/bills">All bills ${icon('chevron-right', 13)}</a>
      </div>
      ${
        upcoming.length
          ? `<div class="bills-total">
              <span class="tiny muted">Next 30 days</span>
              <strong class="num">${money(total30, { cents: false })}</strong>
            </div>
            <ul class="bill-list">
              ${upcoming
                .map((bill) => {
                  const days = diffDays(today, bill.nextDue);
                  const due = relativeDue(bill.nextDue, today);
                  const cat = categoryMeta(bill.category);
                  const kind = billKind(bill.kind);
                  return `<li class="bill-mini ${days <= 0 ? 'is-due' : ''}">
                    <span class="bill-mini__icon tone tone--${cat.tone}">${icon(kind.icon, 17)}</span>
                    <span class="bill-mini__body">
                      <span class="bill-mini__name">${esc(bill.name)}</span>
                      <span class="bill-mini__due ${days <= 0 ? 'is-due' : days <= 7 ? 'is-soon' : ''}">${due.label} · ${bill.frequency}</span>
                    </span>
                    <span class="bill-mini__amount">${money(bill.amount)}</span>
                  </li>`;
                })
                .join('')}
            </ul>`
          : '<p class="tiny muted">Nothing due in the next month. The ledger is quiet.</p>'
      }`;
  }

  function budgetCardMarkup() {
    const totals = state.overview.totals;
    const level = budgetLevel(totals.percent);
    const left = totals.budget - totals.spent;
    const rows = state.overview.rows
      .filter((row) => row.limit > 0)
      .sort((a, b) => b.percent - a.percent)
      .slice(0, 3);

    return `<div class="card-head">
        <div>
          <span class="card-kicker">${formatDate(today, 'month')}</span>
          <h2>Budget pulse</h2>
        </div>
        <a class="card-link" href="#/money">Details ${icon('chevron-right', 13)}</a>
      </div>
      <div class="budget-top">
        ${ring({
          value: Math.min(100, totals.percent),
          size: 82,
          stroke: 7,
          label: `${Math.round(totals.percent)}%`,
          sub: 'used',
          level: level === 'ok' ? '' : level,
        })}
        <div class="budget-figures">
          <strong class="num">${money(totals.spent)}</strong>
          <span class="tiny muted">of ${money(totals.budget, { cents: false })} budgeted</span>
          <span class="budget-left ${left < 0 ? 'is-over' : ''}">${money(Math.abs(left), { cents: false })} ${left >= 0 ? 'left' : 'over'}</span>
        </div>
      </div>
      <div class="budget-rows">
        ${rows
          .map(
            (row) => `<div class="budget-mini">
              <div class="budget-mini__head">
                <span>${esc(row.label)}</span>
                <span>${money(row.spent, { cents: false })} / ${money(row.limit, { cents: false })}</span>
              </div>
              ${bar(Math.min(100, row.percent), { level: budgetLevel(row.percent), thin: true, label: `${row.label} budget used` })}
            </div>`
          )
          .join('')}
      </div>`;
  }

  function habitRowMarkup(habit) {
    const meta =
      habit.streak > 0
        ? `<span class="habit-streak">${icon('flame', 11)} ${habit.streak}-day streak</span>`
        : `${habit.weekCount}/${habit.targetPerWeek} this week`;
    return `<li class="habit-mini">
      <span class="habit-mini__icon tone tone--${habit.tone || 'sage'}">${icon(habit.icon || 'sprout', 16)}</span>
      <span class="habit-mini__body">
        <span class="habit-mini__name">${esc(habit.name)}</span>
        <span class="habit-mini__meta">${meta}</span>
      </span>
      <button class="habit-check" type="button" data-habit-toggle="${habit.id}" aria-pressed="${habit.doneToday}" aria-label="${habit.doneToday ? 'Undo' : 'Mark'} ${esc(habit.name)} for today">
        ${icon('check', 13)}
      </button>
    </li>`;
  }

  function habitsCardInner() {
    const rows = habitSummary(state.habits, today);
    const done = rows.filter((row) => row.doneToday).length;
    return `<div class="card-head">
        <div>
          <span class="card-kicker">Growth</span>
          <h2>Little things</h2>
          <p class="card-head__sub" data-habits-count>${done} of ${rows.length} kept today</p>
        </div>
        <a class="card-link" href="#/habits">All ${icon('chevron-right', 13)}</a>
      </div>
      ${
        rows.length
          ? `<ul class="habit-list" data-habit-list>${rows.map(habitRowMarkup).join('')}</ul>`
          : `<p class="tiny muted">No habits yet. Start with one small, repeatable thing.</p>`
      }`;
  }

  function goalsCardMarkup() {
    const shown = state.goals.slice(0, 4);
    return `<div class="card-head">
        <div>
          <span class="card-kicker">The longer view</span>
          <h2>Where you’re headed</h2>
        </div>
        <a class="card-link" href="#/habits">Goals ${icon('chevron-right', 13)}</a>
      </div>
      ${
        shown.length
          ? `<div class="goal-grid">
              ${shown
                .map((goal) => {
                  const percent = goalPercent(goal);
                  const progress =
                    goal.unit === '%'
                      ? `${Math.round(goal.current)}% complete`
                      : `${goal.current} / ${goal.target} ${goal.unit}`;
                  return `<div class="goal-mini">
                    ${ring({ value: percent, size: 48, stroke: 5, label: `${Math.round(percent)}%` })}
                    <span class="goal-mini__body">
                      <span class="goal-mini__title">${esc(goal.title)}</span>
                      <span class="goal-mini__meta">${progress} · ${formatDate(goal.targetDate, 'short')}</span>
                    </span>
                  </div>`;
                })
                .join('')}
            </div>`
          : '<p class="tiny muted">No goals yet. Give the year a direction.</p>'
      }`;
  }

  root.innerHTML = `<div class="page dashboard">
    ${heroMarkup()}
    <div class="dash-grid">
      <div class="dash-cell dash-mood">${moodCardMarkup()}</div>
      <section class="card plan-card dash-cell dash-plan" data-plan-card>${planCardInner()}</section>
      <section class="card bills-card dash-cell dash-bills" data-bills-card>${billsCardMarkup()}</section>
      <section class="card budget-card dash-cell dash-budget" data-budget-card>${budgetCardMarkup()}</section>
      <section class="card habits-card dash-cell dash-habits" data-habits-card>${habitsCardInner()}</section>
      <section class="card goals-card dash-cell dash-goals" data-goals-card>${goalsCardMarkup()}</section>
    </div>
  </div>`;

  hydrateRings(root);

  async function chooseMood(level) {
    if (!level || state.busyMood) return;
    state.busyMood = true;
    try {
      state.checkin = await saveCheckin(today, level);
      const meta = moodMeta(level);
      root.querySelectorAll('[data-dash-mood]').forEach((btn) => {
        btn.setAttribute('aria-pressed', String(Number(btn.dataset.dashMood) === level));
      });
      const tag = root.querySelector('[data-mood-tag]');
      if (tag) {
        tag.textContent = meta.label;
        tag.hidden = false;
      }
      const note = root.querySelector('[data-mood-note]');
      if (note) note.textContent = moodNoteText();

      const todayCell = root.querySelector(`[data-mood-day="${today}"] .mood-day__face`);
      if (todayCell) todayCell.innerHTML = moodFace(level, 18);

      let reshaped = false;
      if (state.plan && state.plan.status !== 'accepted') {
        state.plan = await generatePlan(today);
        const planCard = root.querySelector('[data-plan-card]');
        if (planCard) planCard.innerHTML = planCardInner();
        const chips = root.querySelector('[data-hero-chips]');
        if (chips) chips.innerHTML = heroChips();
        reshaped = true;
      }

      const heroPip = root.querySelector('[data-hero-puffy data-hero-pip]');
      if (heroPip) heroPip.innerHTML = pip({ mood: heroMood(), size: 184, float: true });
      const heroNudge = root.querySelector('[data-hero-nudge]');
      if (heroNudge) heroNudge.textContent = nudge();

      ctx.toast(`Mood noted — ${meta.label}.${reshaped ? ' Puffy reshaped the plan.' : ''}`);
    } catch (err) {
      console.warn('Could not save mood', err);
      ctx.toast('The check-in did not save. Try once more.', { type: 'error' });
    } finally {
      state.busyMood = false;
    }
  }

  async function chooseHabit(button) {
    const id = button.dataset.habitToggle;
    if (!id || button.disabled) return;
    button.disabled = true;
    try {
      const updated = await toggleHabit(id, today);
      state.habits = state.habits.map((habit) => (habit.id === updated.id ? updated : habit));
      const rows = habitSummary(state.habits, today);
      const list = root.querySelector('[data-habit-list]');
      if (list) list.innerHTML = rows.map(habitRowMarkup).join('');
      const count = root.querySelector('[data-habits-count]');
      const done = rows.filter((row) => row.doneToday).length;
      if (count) count.textContent = `${done} of ${rows.length} kept today`;
      const row = rows.find((item) => item.id === id);
      if (row) {
        ctx.toast(
          row.doneToday ? `${row.name} — kept for today.` : `${row.name} — unmarked for today.`,
          { type: row.doneToday ? 'success' : 'default' }
        );
      }
    } catch (err) {
      console.warn('Could not update habit', err);
      ctx.toast('That habit did not save. Try once more.', { type: 'error' });
      button.disabled = false;
    }
  }

  const onClick = (event) => {
    const moodButton = event.target.closest('[data-dash-mood]');
    if (moodButton) {
      chooseMood(Number(moodButton.dataset.dashMood));
      return;
    }
    const habitButton = event.target.closest('[data-habit-toggle]');
    if (habitButton) chooseHabit(habitButton);
  };

  root.addEventListener('click', onClick);

  return {
    destroy() {
      root.removeEventListener('click', onClick);
    },
  };
}
