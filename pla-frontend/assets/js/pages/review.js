import { getWeeklyReview, getCheckins } from '../api.js';
import { goalPercent } from '../analytics.js';
import {
  addDays,
  esc,
  formatDate,
  isoDate,
  money,
  relativeDue,
  todayISO,
} from '../ui/format.js';
import { bar, hydrateRings, moodFace, pageHead, ring } from '../ui/widgets.js';
import { icon } from '../icons.js';
import { pip } from '../mascot.js';

const MAX_DONE = 6;

export default async function reviewPage(root, ctx) {
  const today = todayISO();
  let state = {
    offset: 0,
    review: null,
    checkins: [],
  };
  let generation = 0;

  root.innerHTML = `<div class="page review-page">
    <div class="page-loading" aria-busy="true">
      <div class="skeleton page-loading__head"></div>
      <div class="skeleton page-loading__ledger"></div>
      <div class="skeleton page-loading__chart"></div>
      <div class="skeleton page-loading__row"></div>
      <span class="sr-only">Gathering your week</span>
    </div>
  </div>`;

  const refDate = () => addDays(today, state.offset * 7);

  async function load() {
    const token = ++generation;
    const ref = refDate();
    const [review, checkins] = await Promise.all([
      getWeeklyReview(ref),
      getCheckins(addDays(ref, -6), ref),
    ]);
    if (token !== generation) return;
    state.review = review;
    state.checkins = checkins;
    paint();
  }

  try {
    const ref = refDate();
    [state.review, state.checkins] = await Promise.all([
      getWeeklyReview(ref),
      getCheckins(addDays(ref, -6), ref),
    ]);
  } catch (err) {
    console.error(err);
    root.innerHTML = `<div class="page"><div class="card card--pad-lg">
      <span class="eyebrow">The weekly review</span>
      <h2 style="margin:10px 0 8px">The week didn’t come together.</h2>
      <p class="muted small">The local database could not be read. Nothing has been lost — try reloading this page.</p>
      <button class="btn btn--primary" type="button" style="margin-top:16px" data-retry>Reload the page</button>
    </div></div>`;
    root.querySelector('[data-retry]')?.addEventListener('click', () => window.location.reload());
    return {};
  }

  const habitChecks = () =>
    state.review.habitRows.reduce((total, h) => total + (Number(h.weekCount) || 0), 0);
  const avgMood = () => {
    const moods = state.checkins.map((c) => Number(c.mood) || 0).filter(Boolean);
    return moods.length ? moods.reduce((a, b) => a + b, 0) / moods.length : 0;
  };
  const missingMoodDays = () => 7 - state.checkins.length;

  function headerActions() {
    const label =
      state.offset === 0
        ? 'Last 7 days'
        : `${formatDate(state.review.range.start, 'short')} – ${formatDate(state.review.range.end, 'short')}`;
    return `<div class="review-actions">
      ${state.offset < 0 ? `<button class="chip review-today" type="button" data-week-reset>Back to this week</button>` : ''}
      <div class="month-nav review-nav" role="group" aria-label="Change the week being reviewed">
        <button class="icon-btn icon-btn--bordered" type="button" data-week="-1" aria-label="Previous seven days">
          ${icon('chevron-left', 16)}
        </button>
        <span class="month-nav__label">${label}</span>
        <button class="icon-btn icon-btn--bordered" type="button" data-week="1" aria-label="Next seven days" ${state.offset >= 0 ? 'disabled' : ''}>
          ${icon('chevron-right', 16)}
        </button>
      </div>
    </div>`;
  }

  function summaryLine(r) {
    const parts = [];
    parts.push(`finished ${r.completedCount} task${r.completedCount === 1 ? '' : 's'}`);
    parts.push(`kept ${habitChecks()} habit check-in${habitChecks() === 1 ? '' : 's'}`);
    parts.push(`spent ${money(r.spendNow, { cents: false })}`);
    let line = `Between ${formatDate(r.range.start, 'short')} and ${formatDate(
      r.range.end,
      'short'
    )}, you ${parts.join(', ')}.`;
    if (r.spendPrev > 0) {
      line +=
        r.change === 0
          ? ' Spending was level with the week before.'
          : ` Spending was ${Math.abs(r.change)}% ${r.change > 0 ? 'above' : 'below'} the week before.`;
    }
    if (missingMoodDays() > 0) {
      line += ` You checked in on your mood ${state.checkins.length} of 7 days.`;
    }
    return line;
  }

  function ledger(r) {
    return `<section class="ledger review-ledger" aria-label="Week at a glance">
      <div class="ledger-cell" data-ledger-cell="sage">
        <span class="ledger-cell__label"><span class="pill-dot"></span>Tasks done</span>
        <strong class="ledger-cell__value">${r.completedCount}</strong>
        <span class="ledger-cell__note">${r.createdCount} added to the list</span>
      </div>
      <div class="ledger-cell" data-ledger-cell="${r.overdueCount ? 'danger' : 'sage'}">
        <span class="ledger-cell__label"><span class="pill-dot"></span>Still open</span>
        <strong class="ledger-cell__value">${r.overdueCount}</strong>
        <span class="ledger-cell__note">${r.overdueCount ? 'past their date' : 'nothing chasing you'}</span>
      </div>
      <div class="ledger-cell" data-ledger-cell="accent">
        <span class="ledger-cell__label"><span class="pill-dot"></span>Spent</span>
        <strong class="ledger-cell__value">${money(r.spendNow, { cents: false })}</strong>
        <span class="ledger-cell__note">${
          r.spendPrev
            ? `${r.change > 0 ? '+' : ''}${r.change}% vs the week before`
            : 'no comparison yet'
        }</span>
      </div>
      <div class="ledger-cell" data-ledger-cell="ochre">
        <span class="ledger-cell__label"><span class="pill-dot"></span>Habits kept</span>
        <strong class="ledger-cell__value">${habitChecks()}</strong>
        <span class="ledger-cell__note">${r.bestHabit ? `best: ${esc(r.bestHabit.name)}` : 'a check-in starts it'}</span>
      </div>
    </section>`;
  }

  function summaryCard(r) {
    return `<section class="card review-summary">
      <div class="review-summary__text">
        <span class="card-kicker">The short version</span>
        <p class="review-summary__line">${esc(summaryLine(r))}</p>
        <p class="review-summary__asideled">No grade, no streak to protect. Just a look at what actually happened.</p>
      </div>
      <div class="review-summary__stamp" aria-hidden="true">${pip({ mood: r.overdueCount ? 'thinking' : 'happy', size: 86 })}</div>
    </section>`;
  }

  function doneCard(r) {
    const done = r.completed
      .slice()
      .sort((a, b) => ((a.completedAt || '') < (b.completedAt || '') ? 1 : -1))
      .slice(0, MAX_DONE);
    const extra = Math.max(0, r.completedCount - done.length);
    return `<section class="card review-card">
      <div class="card-head">
        <div>
          <h2>What got done</h2>
          <p class="card-head__sub">${r.completedCount ? 'the ticks that counted' : 'quiet is allowed'}</p>
        </div>
        <a class="card-link" href="#/tasks">All tasks ${icon('chevron-right', 13)}</a>
      </div>
      ${
        done.length
          ? `<ul class="review-done">
              ${done
                .map(
                  (t) => `<li>
                    <span class="review-done__check">${icon('check', 11)}</span>
                    <span class="review-done__title">${esc(t.title)}</span>
                    <span class="review-done__date">${t.completedAt ? formatDate(isoDate(new Date(t.completedAt)), 'short') : ''}</span>
                  </li>`
                )
                .join('')}
            </ul>
            ${extra ? `<p class="tiny muted review-more">+ ${extra} more finished this week.</p>` : ''}`
          : `<div class="mini-empty">${icon('coffee', 22)}<p>No task was marked done in this window. Rest and thinking count too.</p></div>`
      }
    </section>`;
  }

  function moneyCard(r) {
    const peak = Math.max(r.spendNow, r.spendPrev, 1);
    const nowWidth = Math.round((r.spendNow / peak) * 100);
    const prevWidth = Math.round((r.spendPrev / peak) * 100);
    const cats = r.topCategories.slice(0, 4);
    const tone = r.change > 0 ? 'up' : 'down';
    return `<section class="card review-card">
      <div class="card-head">
        <div>
          <h2>Money, in context</h2>
          <p class="card-head__sub">spending, without the lecture</p>
        </div>
        <a class="card-link" href="#/money">Ledger ${icon('chevron-right', 13)}</a>
      </div>
      <div class="review-money">
        <div class="review-money__headline">
          <strong>${money(r.spendNow, { cents: false })}</strong>
          ${r.spendPrev ? `<span class="review-change review-change--${tone}">${icon(tone === 'up' ? 'arrow-up-right' : 'arrow-down', 12)} ${Math.abs(r.change)}%</span>` : ''}
        </div>
        <div class="review-compare">
          <div class="review-compare__row">
            <span>This window</span>
            <span class="review-compare__track"><span class="review-compare__fill" style="--p:${nowWidth}"></span></span>
            <strong>${money(r.spendNow, { cents: false })}</strong>
          </div>
          <div class="review-compare__row review-compare__row--muted">
            <span>Before</span>
            <span class="review-compare__track"><span class="review-compare__fill" style="--p:${prevWidth}"></span></span>
            <strong>${r.spendPrev ? money(r.spendPrev, { cents: false }) : '—'}</strong>
          </div>
        </div>
      </div>
      ${
        cats.length
          ? `<ul class="review-cats">
              ${cats
                .map(
                  (c) => `<li>
                    <span class="review-cats__label">${esc(c.label)}</span>
                    <span class="review-cats__bar">${bar(r.spendNow ? (c.amount / r.spendNow) * 100 : 0, { thin: true, label: `Share of spending: ${c.label}` })}</span>
                    <strong>${money(c.amount, { cents: false })}</strong>
                  </li>`
                )
                .join('')}
            </ul>`
          : `<div class="mini-empty">${icon('card', 22)}<p>No spending recorded in this window.</p></div>`
      }
    </section>`;
  }

  function habitsCard(r) {
    const rows = r.habitRows.slice().sort((a, b) => b.weekCount / b.targetPerWeek - a.weekCount / a.targetPerWeek);
    return `<section class="card review-card">
      <div class="card-head">
        <div>
          <h2>Habits kept</h2>
          <p class="card-head__sub">${r.bestHabit ? `“${esc(r.bestHabit.name)}” led the week` : 'the quiet rows'}</p>
        </div>
        <a class="card-link" href="#/habits">Garden ${icon('chevron-right', 13)}</a>
      </div>
      ${
        rows.length
          ? `<ul class="review-habits">
              ${rows
                .map((h) => {
                  const p = Math.min(100, Math.round((h.weekCount / h.targetPerWeek) * 100));
                  return `<li>
                    <span class="review-habits__icon tone tone--${h.tone || 'sage'}">${icon(h.icon || 'sprout', 14)}</span>
                    <span class="review-habits__body">
                      <span class="review-habits__line">
                        <span class="review-habits__name">${esc(h.name)}</span>
                        <span class="review-habits__count">${h.weekCount}/${h.targetPerWeek}</span>
                      </span>
                      ${bar(p, { thin: true, level: p >= 100 ? 'sage' : '', label: `${h.name}: ${h.weekCount} of ${h.targetPerWeek} this week` })}
                    </span>
                    ${h.streak > 1 ? `<span class="review-habits__streak">${icon('flame', 11)} ${h.streak}</span>` : ''}
                  </li>`;
                })
                .join('')}
            </ul>`
          : `<div class="mini-empty">${icon('sprout', 22)}<p>No habits planted yet. One small row is enough to start.</p></div>`
      }
    </section>`;
  }

  function goalsCard(r) {
    return `<section class="card review-card">
      <div class="card-head">
        <div>
          <h2>Goals on the horizon</h2>
          <p class="card-head__sub">${state.offset === 0 ? 'where the stakes stand' : 'as they stood then'}</p>
        </div>
        <a class="card-link" href="#/habits">Goals ${icon('chevron-right', 13)}</a>
      </div>
      ${
        r.goals.length
          ? `<ul class="review-goals">
              ${r.goals
                .slice(0, 4)
                .map(
                  (g) => `<li>
                    ${ring({ value: goalPercent(g), size: 46, stroke: 4, label: `${Math.round(goalPercent(g))}%`, labelClass: 'review-goals__ring' })}
                    <span class="review-goals__body">
                      <span class="review-goals__title">${esc(g.title)}</span>
                      <span class="review-goals__meta">${Number(g.current)} / ${Number(g.target)} ${esc(g.unit || '')} · ${formatDate(g.targetDate, 'short')}</span>
                    </span>
                  </li>`
                )
                .join('')}
            </ul>`
          : `<div class="mini-empty">${icon('target', 22)}<p>No goals yet. Give the next month a direction.</p></div>`
      }
      ${r.goals.length > 4 ? `<p class="tiny muted review-more">+ ${r.goals.length - 4} more on the garden page.</p>` : ''}
    </section>`;
  }

  function suggestionsCard(r) {
    return `<section class="card review-suggestions">
      <div class="card-head">
        <div>
          <h2>For the next seven days</h2>
          <p class="card-head__sub">small, optional, and entirely yours</p>
        </div>
        <span class="tag tag--accent">${icon('sparkles', 11)} Pip’s notes</span>
      </div>
      <ol class="review-notes">
        ${r.suggestions
          .map(
            (s, i) => `<li>
              <span class="review-notes__num" aria-hidden="true">0${i + 1}</span>
              <p>${esc(s)}</p>
            </li>`
          )
          .join('')}
      </ol>
    </section>`;
  }

  function moodCard() {
    const ref = refDate();
    const days = Array.from({ length: 7 }, (_, i) => addDays(ref, i - 6));
    const byDate = new Map(state.checkins.map((c) => [c.date, c]));
    const mood = avgMood();
    return `<section class="rail-card card review-mood">
      <div class="rail-card__head">
        <span class="card-kicker">Mood check-ins</span>
        <span class="tiny muted">${state.checkins.length} of 7</span>
      </div>
      <div class="mood-strip">
        ${days
          .map((d) => {
            const c = byDate.get(d);
            const label = c
              ? `${formatDate(d, 'weekday-long')}: mood ${c.mood} of 5`
              : `${formatDate(d, 'weekday-long')}: no check-in`;
            return `<span class="mood-strip__day${c ? ' is-logged' : ''}" title="${esc(label)}">
              <span class="mood-strip__face" aria-hidden="true">${c ? moodFace(Number(c.mood)) : '<span class="mood-strip__blank"></span>'}</span>
              <span class="mood-strip__label" aria-hidden="true">${formatDate(d, 'weekday').slice(0, 1)}</span>
              <span class="sr-only">${esc(label)}</span>
            </span>`;
          })
          .join('')}
      </div>
      <p class="tiny muted">${mood ? `The week averaged ${mood.toFixed(1)} out of 5 — ${mood >= 4 ? 'a good run' : mood >= 3 ? 'steady enough' : 'a heavier week, held gently'}.` : 'No mood check-ins in this window.'}</p>
    </section>`;
  }

  function overdueCard(r) {
    if (!r.overdueCount) return '';
    return `<section class="rail-card card">
      <div class="rail-card__head">
        <span class="card-kicker">Still open</span>
        <span class="tiny muted">${r.overdueCount}</span>
      </div>
      <ul class="review-overdue">
        ${r.overdue
          .slice()
          .sort((a, b) => ((a.due || '') < (b.due || '') ? -1 : 1))
          .slice(0, 4)
          .map((t) => {
            const due = relativeDue(t.due, r.range.end);
            return `<li>
              <span class="review-overdue__title">${esc(t.title)}</span>
              <span class="review-overdue__due" data-tone="${due.tone}">${due.label}</span>
            </li>`;
          })
          .join('')}
      </ul>
      <a class="card-link" href="#/tasks">Open the list ${icon('arrow-right', 13)}</a>
    </section>`;
  }

  function rail(r) {
    const message = r.overdueCount
      ? `${r.overdueCount} thing${r.overdueCount === 1 ? '' : 's'} still open. Pick the one that takes ten minutes first — momentum beats guilt.`
      : r.completedCount
      ? `${r.completedCount} finished, and the list is lighter. Carry one good habit into next week, not all of them.`
      : 'A quiet week is still a week. Choose one small thing for the next seven days and let that be the whole plan.';
    return `<aside class="review-rail" aria-label="Week details">
      ${moodCard()}
      ${overdueCard(r)}
      <section class="rail-card card rail-card--pip">
        ${pip({ mood: r.overdueCount > 2 ? 'thinking' : 'happy', size: 60 })}
        <div>
          <span class="card-kicker">Pip says</span>
          <p class="rail-pip">${message}</p>
        </div>
      </section>
      <section class="rail-card card rail-card--quiet">
        <span class="card-kicker">One small ask</span>
        <p class="rail-pip" style="margin-top:8px">Before you close this page, choose one thing for Monday. Not three. One.</p>
      </section>
    </aside>`;
  }

  function paint() {
    const r = state.review;
    root.innerHTML = `<div class="page review-page">
      ${pageHead({
        eyebrow: 'The weekly review',
        title: state.offset === 0 ? 'The week, held up to the light.' : 'A week, revisited.',
        sub: 'A short look back at what moved, what slipped, and one thing worth carrying forward. No grade attached.',
        actions: headerActions(),
      })}
      ${ledger(r)}
      <div class="review-layout">
        <div class="review-main">
          ${summaryCard(r)}
          <div class="review-pair">
            ${doneCard(r)}
            ${moneyCard(r)}
          </div>
          ${suggestionsCard(r)}
          <div class="review-pair">
            ${habitsCard(r)}
            ${goalsCard(r)}
          </div>
        </div>
        ${rail(r)}
      </div>
    </div>`;
    hydrateRings(root);
  }

  async function onClick(event) {
    const week = event.target.closest('[data-week]');
    if (week) {
      const next = state.offset + Number(week.dataset.week);
      if (next > 0) return;
      state.offset = next;
      try {
        await load();
      } catch (err) {
        console.error(err);
        ctx.toast('That week could not be loaded.', { type: 'error' });
        state.offset -= Number(week.dataset.week);
      }
      return;
    }
    if (event.target.closest('[data-week-reset]')) {
      state.offset = 0;
      await load().catch((err) => {
        console.error(err);
        ctx.toast('The current week could not be loaded.', { type: 'error' });
      });
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
