import {
  getBills,
  getPayments,
  saveBill,
  deleteBill,
  markBillPaid,
  advanceDue,
} from '../api.js';
import { BILL_KINDS, FREQUENCIES, billKind } from '../constants.js';
import {
  addDays,
  esc,
  formatDate,
  money,
  relativeDue,
  todayISO,
} from '../ui/format.js';
import { pageHead } from '../ui/widgets.js';
import { icon } from '../icons.js';
import { openSheet, confirmSheet } from '../ui/sheet.js';
import { toast, toastError } from '../ui/toast.js';
import { pip } from '../mascot.js';

const FREQ_LABEL = Object.fromEntries(FREQUENCIES.map((f) => [f.id, f.label]));

const monthlyEquivalent = (bill) => {
  const amount = Number(bill.amount) || 0;
  if (bill.frequency === 'weekly') return (amount * 52) / 12;
  if (bill.frequency === 'quarterly') return amount / 3;
  if (bill.frequency === 'yearly') return amount / 12;
  return amount;
};

const sum = (list) => list.reduce((total, item) => total + (Number(item.amount) || 0), 0);

const freqPhrase = (frequency) =>
  ({
    weekly: 'Every week',
    monthly: 'Once a month',
    quarterly: 'Every three months',
    yearly: 'Once a year',
  }[frequency] || FREQ_LABEL[frequency] || 'Recurring');

const nextDueAfter = (bill, paidDate) => {
  let date = bill.nextDue || paidDate;
  let guard = 0;
  do {
    date = advanceDue(date, bill.frequency);
    guard += 1;
  } while (date <= paidDate && guard < 36);
  return date;
};

export default async function bills(root, ctx) {
  let state = { bills: [] };
  let generation = 0;

  root.innerHTML = `<div class="page bills-page">
    <div class="page-loading" aria-busy="true">
      <div class="skeleton page-loading__head"></div>
      <div class="skeleton page-loading__ledger"></div>
      <div class="skeleton page-loading__row"></div>
      <div class="skeleton page-loading__row"></div>
      <div class="skeleton page-loading__row"></div>
      <span class="sr-only">Loading your bills</span>
    </div>
  </div>`;

  try {
    state.bills = await getBills();
  } catch (err) {
    console.error(err);
    root.innerHTML = `<div class="page"><div class="card card--pad-lg">
      <span class="eyebrow">The regulars</span>
      <h2 style="margin:10px 0 8px">Your bills didn’t load.</h2>
      <p class="muted small">The local database could not be read. Nothing has been lost — try reloading this page.</p>
      <button class="btn btn--primary" type="button" style="margin-top:16px" data-retry>Reload the page</button>
    </div></div>`;
    root.querySelector('[data-retry]')?.addEventListener('click', () => window.location.reload());
    return {};
  }

  const findBill = (id) => state.bills.find((b) => b.id === id);

  function summary() {
    const today = todayISO();
    const weekEnd = addDays(today, 7);
    const overdue = state.bills.filter((b) => b.nextDue < today);
    const week = state.bills.filter((b) => b.nextDue >= today && b.nextDue <= weekEnd);
    const monthNorm = state.bills.reduce((total, b) => total + monthlyEquivalent(b), 0);
    const next = state.bills.filter((b) => b.nextDue >= today)[0] || state.bills[0];
    const month = today.slice(0, 7);
    const paidThisMonth = state.bills.reduce(
      (total, b) =>
        total + (b.payments || []).filter((p) => (p.date || '').startsWith(month)).reduce((s, p) => s + Number(p.amount || 0), 0),
      0
    );
    const stillThisMonth = state.bills
      .filter((b) => (b.nextDue || '').startsWith(month))
      .reduce((total, b) => total + Number(b.amount || 0), 0);
    return {
      today,
      overdue,
      week,
      monthNorm,
      next,
      paidThisMonth,
      stillThisMonth,
      overdueTotal: sum(overdue),
      weekTotal: sum(week),
    };
  }

  function ledger(s) {
    const nextMeta = s.next
      ? `${esc(s.next.name)} · ${relativeDue(s.next.nextDue, s.today).label.toLowerCase()}`
      : 'Nothing on the calendar';
    return `<section class="ledger bill-ledger" aria-label="Bills summary">
      <div class="ledger-cell" data-ledger-cell="ochre">
        <span class="ledger-cell__label"><span class="pill-dot"></span>Due this week</span>
        <strong class="ledger-cell__value">${money(s.weekTotal, { cents: false })}</strong>
        <span class="ledger-cell__note">${s.week.length} bill${s.week.length === 1 ? '' : 's'} in the next seven days</span>
      </div>
      <div class="ledger-cell" data-ledger-cell="danger">
        <span class="ledger-cell__label"><span class="pill-dot"></span>Overdue</span>
        <strong class="ledger-cell__value">${s.overdue.length}</strong>
        <span class="ledger-cell__note">${s.overdue.length ? `${money(s.overdueTotal, { cents: false })} waiting` : 'nothing chasing you'}</span>
      </div>
      <div class="ledger-cell" data-ledger-cell="accent">
        <span class="ledger-cell__label"><span class="pill-dot"></span>Monthly rhythm</span>
        <strong class="ledger-cell__value">${money(s.monthNorm, { cents: false })}</strong>
        <span class="ledger-cell__note">averaged across the year</span>
      </div>
      <div class="ledger-cell" data-ledger-cell="sage">
        <span class="ledger-cell__label"><span class="pill-dot"></span>Next up</span>
        <strong class="ledger-cell__value">${s.next ? money(s.next.amount, { cents: false }) : '—'}</strong>
        <span class="ledger-cell__note">${nextMeta}</span>
      </div>
    </section>`;
  }

  function billRow(bill, today) {
    const meta = billKind(bill.kind);
    const due = relativeDue(bill.nextDue, today);
    const last = (bill.payments || [])[0];
    return `<li class="bill-row" data-id="${bill.id}" data-tone="${due.tone}">
      <span class="bill-icon tone--${meta.tone}" aria-hidden="true">${icon(bill.icon || meta.icon, 19)}</span>
      <div class="bill-body">
        <div class="bill-name-row">
          <h3>${esc(bill.name)}</h3>
          ${due.tone === 'overdue' ? '<span class="tag tag--danger">Late</span>' : ''}
        </div>
        <p class="bill-meta">
          <span>${freqPhrase(bill.frequency)}</span>
          <span aria-hidden="true">·</span>
          <span>${last ? `Last paid ${formatDate(last.date, 'short')}` : 'No payments yet'}</span>
          <span aria-hidden="true">·</span>
          <span>${Number(bill.remindDaysBefore ?? 3) === 0 ? 'Reminder on the day' : `Reminder ${Number(bill.remindDaysBefore ?? 3)}d before`}</span>
        </p>
        ${bill.notes ? `<p class="bill-note">${esc(bill.notes)}</p>` : ''}
      </div>
      <div class="bill-money">
        <strong>${money(bill.amount)}</strong>
        <span class="bill-due" data-tone="${due.tone}">${due.label}</span>
      </div>
      <div class="bill-actions">
        <button class="btn btn--sm btn--secondary bill-pay" type="button" data-action="pay"
          aria-label="Mark ${esc(bill.name)} paid">
          ${icon('check', 14)}<span class="bill-pay__text">Mark paid</span>
        </button>
        <details class="row-menu">
          <summary class="icon-btn bill-more" aria-label="More options for ${esc(bill.name)}">${icon('more', 17)}</summary>
          <div class="menu menu--right">
            <button type="button" data-action="history">${icon('clock', 15)} Payment history</button>
            <button type="button" data-action="edit">${icon('edit', 15)} Edit bill</button>
            <button type="button" class="menu__danger" data-action="delete">${icon('trash', 15)} Delete</button>
          </div>
        </details>
      </div>
    </li>`;
  }

  function groups(s) {
    const soon = state.bills.filter((b) => b.nextDue >= s.today && b.nextDue <= addDays(s.today, 7));
    const later = state.bills.filter((b) => b.nextDue > addDays(s.today, 7));
    const sections = [
      { id: 'overdue', title: 'Overdue', note: 'the ones to clear first', list: s.overdue },
      { id: 'soon', title: 'Next seven days', note: 'on the near horizon', list: soon },
      { id: 'later', title: 'Later', note: 'already handled by future you', list: later },
    ];
    return sections
      .filter((section) => section.list.length)
      .map(
        (section) => `<section class="bill-group" aria-labelledby="bill-group-${section.id}">
          <div class="bill-group__head">
            <h2 id="bill-group-${section.id}">${section.title} <span class="seg-count">${section.list.length}</span></h2>
            <span class="bill-group__note">${section.note}</span>
          </div>
          <ul class="bill-list">${section.list.map((b) => billRow(b, s.today)).join('')}</ul>
        </section>`
      )
      .join('');
  }

  function rail(s) {
    const next = state.bills.filter((b) => b.nextDue >= s.today).slice(0, 3);
    const total = s.paidThisMonth + s.stillThisMonth;
    const ratio = total ? Math.min(100, Math.round((s.paidThisMonth / total) * 100)) : 0;
    return `<aside class="bills-rail" aria-label="Bills at a glance">
      <section class="rail-card card">
        <div class="rail-card__head">
          <span class="card-kicker">Next up</span>
          <span class="tiny muted">${next.length} ahead</span>
        </div>
        <ul class="bill-next">
          ${next
            .map((b) => {
              const due = relativeDue(b.nextDue, s.today);
              return `<li>
                <span class="bill-next__icon tone--${billKind(b.kind).tone}">${icon(b.icon || billKind(b.kind).icon, 15)}</span>
                <span class="bill-next__body">
                  <span class="bill-next__name">${esc(b.name)}</span>
                  <span class="bill-next__when" data-tone="${due.tone}">${due.label}</span>
                </span>
                <span class="bill-next__amount">${money(b.amount, { cents: false })}</span>
              </li>`;
            })
            .join('')}
        </ul>
        ${next.length ? '' : '<p class="tiny muted">Nothing due. Enjoy the quiet.</p>'}
      </section>

      <section class="rail-card card">
        <div class="rail-card__head">
          <span class="card-kicker">This month</span>
          <span class="tiny muted">${ratio}% paid</span>
        </div>
        <div class="bill-month">
          <div class="bill-month__row"><span>Paid so far</span><strong>${money(s.paidThisMonth)}</strong></div>
          <div class="bill-month__row"><span>Still this month</span><strong>${money(s.stillThisMonth)}</strong></div>
        </div>
        <div class="bar" role="progressbar" aria-label="Bills paid this month" aria-valuenow="${ratio}" aria-valuemin="0" aria-valuemax="100">
          <div class="bar__fill" style="--p:${ratio}"></div>
        </div>
        <p class="tiny muted">A payment writes the expense and rolls the next date forward.</p>
      </section>

      <section class="rail-card card rail-card--puffy rail-card--pip">
        ${pip({ mood: 'happy', size: 64 })}
        <div>
          <span class="card-kicker">Puffy says</span>
          <p class="rail-puffy rail-pip">${
            s.overdue.length
              ? `${s.overdue.length === 1 ? 'One bill has' : `${s.overdue.length} bills have`} slipped past. Pay ${s.overdue.length === 1 ? 'it' : 'them'} and the dates roll forward — no spiral.`
              : 'Bills stop being surprises when you can see them coming. Nothing is chasing you today.'
          }</p>
        </div>
      </section>
    </aside>`;
  }

  function paint() {
    const s = summary();
    root.innerHTML = `<div class="page bills-page">
      ${pageHead({
        eyebrow: 'The regulars',
        title: 'Bills, held steady.',
        sub: 'Rent, utilities, the small subscriptions. Pay once, keep the receipt, let the date roll forward.',
        actions: `
          <a class="btn btn--ghost" href="#/money">${icon('chart', 16)} View spending</a>
          <button class="btn btn--primary" type="button" data-action="add-bill">${icon('plus', 16)} Add a bill</button>`,
      })}
      ${ledger(s)}
      <div class="bills-layout">
        <div class="bills-main">
          ${state.bills.length ? groups(s) : emptyBills()}
        </div>
        ${rail(s)}
      </div>
    </div>`;
  }

  function emptyBills() {
    return `<div class="card empty">
      <h3>No regulars yet</h3>
      <p>Add rent, a phone plan, anything that comes back around. Puffy keeps the dates.</p>
      <button class="btn btn--primary" type="button" data-action="add-bill">${icon('plus', 15)} Add your first bill</button>
    </div>`;
  }

  async function refresh() {
    const token = ++generation;
    const next = await getBills();
    if (token !== generation) return;
    state.bills = next;
    paint();
    ctx.refreshBadges();
  }

  function closeMenus() {
    root.querySelectorAll('details[open]').forEach((d) => d.removeAttribute('open'));
  }

  function openEditor(bill = null) {
    const isEdit = Boolean(bill);
    const kind = bill?.kind || 'custom';
    const defaultLead = Math.min(30, Math.max(0, Number(ctx.getProfile()?.remindDaysBefore ?? 3)));
    const lead = Math.min(30, Math.max(0, Number(bill?.remindDaysBefore ?? defaultLead)));
    const sheet = openSheet({
      eyebrow: isEdit ? 'Edit a regular' : 'A new regular',
      title: isEdit ? 'Change a bill.' : 'Add a bill.',
      subtitle: isEdit
        ? 'Small edits are allowed. Payment history stays untouched.'
        : 'One date, one amount, and it remembers itself from there.',
      body: `<form id="bill-form" novalidate>
        <div class="field">
          <label for="bill-name">Name</label>
          <input class="input" id="bill-name" name="name" required maxlength="60"
            value="${esc(bill?.name || '')}" placeholder="e.g. Internet" autocomplete="off">
        </div>
        <div class="field-row" style="margin-top:14px">
          <div class="field">
            <label for="bill-kind">Kind</label>
            <div class="select-wrap">
              <select class="select" id="bill-kind" name="kind">
                ${BILL_KINDS.map(
                  (k) => `<option value="${k.id}" ${k.id === kind ? 'selected' : ''}>${k.label}</option>`
                ).join('')}
              </select>
              ${icon('chevron-down', 15)}
            </div>
          </div>
          <div class="field">
            <label for="bill-amount">Amount</label>
            <div class="input-group">
              <input class="input" id="bill-amount" name="amount" type="number" inputmode="decimal"
                min="0" step="0.01" required value="${bill ? Number(bill.amount).toFixed(2) : ''}" placeholder="0.00">
              <span class="input-group__suffix">USD</span>
            </div>
          </div>
        </div>
        <div class="field-row" style="margin-top:14px">
          <div class="field">
            <label for="bill-frequency">How often</label>
            <div class="select-wrap">
              <select class="select" id="bill-frequency" name="frequency">
                ${FREQUENCIES.map(
                  (f) => `<option value="${f.id}" ${f.id === (bill?.frequency || 'monthly') ? 'selected' : ''}>${f.label}</option>`
                ).join('')}
              </select>
              ${icon('chevron-down', 15)}
            </div>
          </div>
          <div class="field">
            <label for="bill-due">Next due</label>
            <input class="input" id="bill-due" name="nextDue" type="date" required value="${bill?.nextDue || todayISO()}">
          </div>
        </div>
        <div class="field" style="margin-top:14px">
          <label for="bill-remind">Remind me <span class="field__hint" style="font-weight:400">(before it lands)</span></label>
          <div class="input-group">
            <input class="input" id="bill-remind" name="remindDaysBefore" type="number" inputmode="numeric"
              min="0" max="30" step="1" value="${lead}">
            <span class="input-group__suffix">days before</span>
          </div>
          <p class="field__hint">Zero means a nudge on the due date. The default lives in Settings.</p>
        </div>
        <div class="field" style="margin-top:14px">
          <label for="bill-notes">Notes <span class="field__hint" style="font-weight:400">(optional)</span></label>
          <textarea class="textarea" id="bill-notes" name="notes" rows="2" maxlength="240"
            placeholder="Where it goes, who to ask, the reference number…">${esc(bill?.notes || '')}</textarea>
        </div>
      </form>`,
      footer: `
        ${isEdit ? `<button class="btn btn--danger" type="button" data-delete>${icon('trash', 15)} Delete</button>` : ''}
        <button class="btn btn--ghost" type="button" data-cancel>Cancel</button>
        <button class="btn btn--primary" type="button" data-save>${isEdit ? 'Save changes' : 'Add the bill'}</button>`,
      initialFocus: '#bill-name',
    });

    const form = sheet.dialog.querySelector('#bill-form');
    const kindSelect = sheet.dialog.querySelector('#bill-kind');
    kindSelect.addEventListener('change', () => {
      if (isEdit || sheet.dialog.querySelector('#bill-name').value.trim()) return;
      const meta = billKind(kindSelect.value);
      if (meta.id !== 'custom') sheet.dialog.querySelector('#bill-name').value = meta.label;
    });

    sheet.dialog.querySelector('[data-cancel]').addEventListener('click', sheet.close);
    sheet.dialog.querySelector('[data-save]').addEventListener('click', () => form.requestSubmit());
    sheet.dialog.querySelector('[data-delete]')?.addEventListener('click', async () => {
      sheet.close();
      const ok = await confirmSheet({
        title: 'Delete this bill?',
        message: `“${esc(bill.name)}” and its payment history will be removed. Expenses already recorded stay in your ledger.`,
        confirmLabel: 'Delete bill',
      });
      if (!ok) return;
      await deleteBill(bill.id);
      toast('Bill removed');
      await refresh();
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const name = String(data.get('name') || '').trim();
      const amount = Number(data.get('amount'));
      if (!name) {
        toastError('Give the bill a name first');
        sheet.dialog.querySelector('#bill-name').focus();
        return;
      }
      if (!Number.isFinite(amount) || amount <= 0) {
        toastError('Add an amount greater than zero');
        sheet.dialog.querySelector('#bill-amount').focus();
        return;
      }
      const meta = billKind(String(data.get('kind')));
      const rawRemind = String(data.get('remindDaysBefore') ?? '').trim();
      try {
        await saveBill({
          id: bill?.id,
          name,
          kind: meta.id,
          icon: meta.icon,
          category: meta.category,
          amount,
          frequency: String(data.get('frequency') || 'monthly'),
          nextDue: String(data.get('nextDue') || todayISO()),
          remindDaysBefore: rawRemind === '' ? defaultLead : Math.min(30, Math.max(0, Number(rawRemind) || 0)),
          notes: String(data.get('notes') || '').trim(),
          payments: bill?.payments || [],
        });
        sheet.close();
        toast(isEdit ? `${name} updated` : `${name} added. Puffy will keep the date.`);
        await refresh();
      } catch (err) {
        console.error(err);
        toastError('That bill could not be saved');
      }
    });
  }

  function openPayment(bill) {
    const paidDefault = todayISO();
    const sheet = openSheet({
      eyebrow: 'Record a payment',
      title: `${esc(bill.name)} — $${Number(bill.amount).toFixed(2)}`,
      subtitle: `Next due ${formatDate(bill.nextDue, 'medium')}. Paying early rolls the date forward from there.`,
      body: `<form id="pay-form">
        <div class="field">
          <label for="pay-date">Date paid</label>
          <input class="input" id="pay-date" name="paidDate" type="date" required
            value="${paidDefault}" max="${paidDefault}">
        </div>
        <div class="pay-note">
          ${icon('info', 16)}
          <p>This records an expense in <strong>${esc(billKind(bill.kind).label)}</strong> and moves the next due date to <strong data-next-due>${formatDate(nextDueAfter(bill, paidDefault), 'medium')}</strong>.</p>
        </div>
      </form>`,
      footer: `<button class="btn btn--ghost" type="button" data-cancel>Not yet</button>
        <button class="btn btn--primary" type="button" data-save>${icon('check', 15)} Record payment</button>`,
      initialFocus: '#pay-date',
    });
    const form = sheet.dialog.querySelector('#pay-form');
    const dateInput = sheet.dialog.querySelector('#pay-date');
    dateInput.addEventListener('change', () => {
      const next = nextDueAfter(bill, dateInput.value || paidDefault);
      sheet.dialog.querySelector('[data-next-due]').textContent = formatDate(next, 'medium');
    });
    sheet.dialog.querySelector('[data-cancel]').addEventListener('click', sheet.close);
    sheet.dialog.querySelector('[data-save]').addEventListener('click', () => form.requestSubmit());
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      try {
        const result = await markBillPaid(bill.id, dateInput.value || todayISO());
        sheet.close();
        toast(`${bill.name} paid. Next due ${formatDate(result.bill.nextDue, 'short')}.`);
        await refresh();
      } catch (err) {
        console.error(err);
        toastError('The payment could not be recorded');
      }
    });
  }

  async function openHistory(bill) {
    const payments = await getPayments(bill.id);
    const sheet = openSheet({
      eyebrow: 'Paid, on the record',
      title: `${esc(bill.name)} history`,
      subtitle: `${payments.length} payment${payments.length === 1 ? '' : 's'} · ${formatDate(bill.nextDue, 'medium')} is next.`,
      body: payments.length
        ? `<ul class="pay-history">
            ${payments
              .map(
                (p) => `<li>
                  <span class="pay-history__date">${formatDate(p.date, 'long')}</span>
                  <span class="pay-history__amount">${money(p.amount)}</span>
                </li>`
              )
              .join('')}
          </ul>`
        : `<div class="mini-empty">
            ${icon('clock', 22)}
            <p>No payments recorded yet. The first one will show up here.</p>
          </div>`,
      footer: `<button class="btn btn--ghost" type="button" data-cancel>Close</button>
        <button class="btn btn--primary" type="button" data-pay>${icon('check', 15)} Mark paid</button>`,
    });
    sheet.dialog.querySelector('[data-cancel]').addEventListener('click', sheet.close);
    sheet.dialog.querySelector('[data-pay]').addEventListener('click', () => {
      sheet.close();
      openPayment(findBill(bill.id) || bill);
    });
  }

  async function onClick(event) {
    const actionEl = event.target.closest('[data-action]');
    if (!actionEl) return;
    const action = actionEl.dataset.action;
    const row = actionEl.closest('[data-id]');
    const bill = row ? findBill(row.dataset.id) : null;
    if (action !== 'add-bill') closeMenus();
    if (action === 'add-bill') {
      openEditor();
      return;
    }
    if (!bill) return;
    if (action === 'pay') openPayment(bill);
    else if (action === 'edit') openEditor(bill);
    else if (action === 'history') openHistory(bill);
    else if (action === 'delete') {
      const ok = await confirmSheet({
        title: 'Delete this bill?',
        message: `“${esc(bill.name)}” and its payment history will be removed. Expenses already recorded stay in your ledger.`,
        confirmLabel: 'Delete bill',
      });
      if (!ok) return;
      await deleteBill(bill.id);
      toast('Bill removed');
      await refresh();
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
