/**
 * Realistic demo data, always relative to "today" so the demo never looks stale.
 * Maya Chen — design postgrad, shared flat, part-time studio work.
 */
import {
  addDays,
  isoDate,
  monthKey,
  shiftMonth,
  todayISO,
} from '../assets/js/ui/format.js';
import { billKind } from '../assets/js/constants.js';

const now = new Date();
const TODAY = todayISO();
const STAMP = now.toISOString();
const THIS_MONTH = monthKey(now);
const LAST_MONTH = shiftMonth(THIS_MONTH, -1);
const TWO_MONTHS_AGO = shiftMonth(THIS_MONTH, -2);
const MONTH_START = `${THIS_MONTH}-01`;

const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);

const base = () => ({ createdAt: STAMP, updatedAt: STAMP, synced: false });
const current = (offset) => {
  const d = addDays(TODAY, offset);
  return d < MONTH_START ? MONTH_START : d;
};

function subtasks(items) {
  return items.map((title) => ({ id: uid(), title, done: false }));
}

function task({
  title,
  notes = '',
  category,
  priority,
  due,
  estimate = 30,
  subs = [],
  done = false,
  completedAt = null,
  order = 0,
}) {
  const when = completedAt || STAMP;
  return {
    id: uid(),
    title,
    notes,
    category,
    priority,
    due,
    estimate,
    subtasks: subs.map((s) =>
      typeof s === 'string' ? { id: uid(), title: s, done: false } : { ...s, id: uid() }
    ),
    done,
    completedAt,
    order,
    history: [
      done
        ? { id: uid(), ts: when, type: 'completed', text: 'Marked done' }
        : { id: uid(), ts: when, type: 'created', text: 'Added to the list' },
    ],
    ...base(),
  };
}

const doneAt = (offset, hour = 17) => {
  const d = addDays(TODAY, offset);
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day, hour, 20).toISOString();
};

const tasks = [
  task({
    title: 'Finish IDP1 interface prototype',
    notes: 'Crit at 2pm Thursday. Needs the walkthrough states, not just the pretty screens.',
    category: 'study',
    priority: 'high',
    due: TODAY,
    estimate: 120,
    order: 1,
    subs: [
      { title: 'Wire up dashboard states', done: true },
      { title: 'Export screens for the crit', done: false },
      { title: 'Write three interaction notes', done: false },
    ],
  }),
  task({
    title: 'Write research summary',
    notes: 'Two pages, plain language, cite the two interviews.',
    category: 'study',
    priority: 'high',
    due: addDays(TODAY, 1),
    estimate: 60,
    order: 2,
    subs: ['Pull quotes from interviews', 'Draft the summary'],
  }),
  task({
    title: 'Send studio invoices',
    category: 'work',
    priority: 'high',
    due: TODAY,
    estimate: 45,
    order: 3,
    subs: ['Invoice mural project', 'Chase the October retainer'],
  }),
  task({
    title: 'Email landlord about the radiator',
    notes: 'Third time cold in the morning. Attach the photo from Tuesday.',
    category: 'home',
    priority: 'medium',
    due: TODAY,
    estimate: 15,
    order: 4,
  }),
  task({
    title: 'Book dentist appointment',
    category: 'health',
    priority: 'medium',
    due: addDays(TODAY, -1),
    estimate: 20,
    order: 5,
  }),
  task({
    title: 'Return the parcel',
    notes: 'Boots are too narrow. Returns label is in the kitchen drawer.',
    category: 'home',
    priority: 'high',
    due: addDays(TODAY, -2),
    estimate: 15,
    order: 6,
  }),
  task({
    title: 'Groceries — milk, oats, greens',
    category: 'home',
    priority: 'low',
    due: TODAY,
    estimate: 25,
    order: 7,
  }),
  task({
    title: 'Call Mum',
    category: 'personal',
    priority: 'medium',
    due: addDays(TODAY, 2),
    estimate: 20,
    order: 8,
  }),
  task({
    title: 'Prep slides for Tuesday seminar',
    category: 'study',
    priority: 'medium',
    due: addDays(TODAY, 2),
    estimate: 75,
    order: 9,
    subs: ['Outline five slides', 'Add the service blueprint'],
  }),
  task({
    title: 'Update portfolio case study',
    category: 'work',
    priority: 'medium',
    due: addDays(TODAY, 5),
    estimate: 90,
    order: 10,
  }),
  task({
    title: 'Plan the weekend hike',
    notes: 'Check the weather Thursday before committing.',
    category: 'personal',
    priority: 'low',
    due: addDays(TODAY, 7),
    estimate: 45,
    order: 11,
  }),
  task({
    title: 'Read one chapter — Design of Everyday Things',
    category: 'study',
    priority: 'low',
    due: addDays(TODAY, 3),
    estimate: 40,
    order: 12,
  }),
  task({
    title: 'Move $150 to the trip fund',
    category: 'finance',
    priority: 'high',
    due: addDays(TODAY, 6),
    estimate: 15,
    order: 13,
  }),
  task({
    title: 'Renew library books',
    category: 'personal',
    priority: 'low',
    due: addDays(TODAY, 4),
    estimate: 10,
    order: 14,
  }),
  task({
    title: '20-minute walk without headphones',
    category: 'health',
    priority: 'medium',
    due: addDays(TODAY, 1),
    estimate: 20,
    order: 15,
  }),
  task({
    title: 'Submit timesheet',
    category: 'work',
    priority: 'medium',
    due: addDays(TODAY, -1),
    estimate: 15,
    order: 16,
    done: true,
    completedAt: doneAt(-1),
  }),
  task({
    title: 'Finish literature matrix',
    category: 'study',
    priority: 'high',
    due: addDays(TODAY, -2),
    estimate: 60,
    order: 17,
    done: true,
    completedAt: doneAt(-2),
  }),
  task({
    title: 'Laundry + change sheets',
    category: 'home',
    priority: 'low',
    due: addDays(TODAY, -1),
    estimate: 30,
    order: 18,
    done: true,
    completedAt: doneAt(-1, 20),
  }),
  task({
    title: 'Renew bus pass',
    category: 'personal',
    priority: 'medium',
    due: addDays(TODAY, -4),
    estimate: 10,
    order: 19,
    done: true,
    completedAt: doneAt(-4),
  }),
  task({
    title: 'Print crit boards',
    category: 'study',
    priority: 'medium',
    due: addDays(TODAY, -3),
    estimate: 20,
    order: 20,
    done: true,
    completedAt: doneAt(-3),
  }),
  task({
    title: 'Book eye test',
    category: 'health',
    priority: 'low',
    due: addDays(TODAY, -6),
    estimate: 15,
    order: 21,
    done: true,
    completedAt: doneAt(-6),
  }),
];

/* ---- Bills --------------------------------------------------------------- */

function bill({
  name,
  kind,
  amount,
  frequency,
  nextDue,
  payments = [],
  notes = '',
  remindDaysBefore = 3,
}) {
  const meta = billKind(kind);
  const history = payments.map((p) => ({ id: uid(), date: p.date, amount: p.amount ?? amount }));
  return {
    id: uid(),
    name,
    kind,
    icon: meta.icon,
    category: meta.category,
    amount,
    frequency,
    nextDue,
    remindDaysBefore,
    notes,
    payments: history.sort((a, b) => (a.date < b.date ? 1 : -1)),
    lastPaid: history[0]?.date || null,
    ...base(),
  };
}

const bills = [
  bill({
    name: 'Rent',
    kind: 'rent',
    amount: 980,
    frequency: 'monthly',
    nextDue: addDays(TODAY, 27),
    remindDaysBefore: 5,
    payments: [{ date: addDays(TODAY, -3) }, { date: addDays(TODAY, -33) }, { date: addDays(TODAY, -63) }],
    notes: 'Half of the two-bed on Alder St. Transfer to Jo.',
  }),
  bill({
    name: 'Electricity',
    kind: 'electricity',
    amount: 64.2,
    frequency: 'monthly',
    nextDue: TODAY,
    payments: [
      { date: addDays(TODAY, -28), amount: 58.4 },
      { date: addDays(TODAY, -59), amount: 61.2 },
      { date: addDays(TODAY, -90), amount: 55.7 },
    ],
    notes: 'Portland General. Usage creeps up when the radiator runs.',
  }),
  bill({
    name: 'Internet',
    kind: 'internet',
    amount: 45,
    frequency: 'monthly',
    nextDue: addDays(TODAY, -2),
    payments: [{ date: addDays(TODAY, -22) }, { date: addDays(TODAY, -52) }, { date: addDays(TODAY, -82) }],
    notes: 'Fiber 300. Split with Jo — slipped past, pay when you can.',
  }),
  bill({
    name: 'Phone',
    kind: 'phone',
    amount: 38,
    frequency: 'monthly',
    nextDue: addDays(TODAY, 5),
    payments: [{ date: addDays(TODAY, -25) }, { date: addDays(TODAY, -55) }, { date: addDays(TODAY, -85) }],
  }),
  bill({
    name: 'Gas',
    kind: 'gas',
    amount: 31.5,
    frequency: 'monthly',
    nextDue: addDays(TODAY, 15),
    payments: [
      { date: addDays(TODAY, -15), amount: 29.1 },
      { date: addDays(TODAY, -46), amount: 33.8 },
      { date: addDays(TODAY, -76), amount: 27.4 },
    ],
  }),
  bill({
    name: 'Water',
    kind: 'water',
    amount: 22.4,
    frequency: 'quarterly',
    nextDue: addDays(TODAY, 24),
    payments: [{ date: addDays(TODAY, -66), amount: 21.1 }, { date: addDays(TODAY, -156), amount: 23.8 }],
  }),
  bill({
    name: 'Spotify Student',
    kind: 'custom',
    amount: 5.99,
    frequency: 'monthly',
    nextDue: addDays(TODAY, 6),
    payments: [{ date: addDays(TODAY, -24) }, { date: addDays(TODAY, -54) }, { date: addDays(TODAY, -84) }],
    notes: 'Student plan — verify eligibility in January.',
  }),
];

/* ---- Transactions -------------------------------------------------------- */

function tx({ type = 'expense', category, amount, date, note = '', billId = null }) {
  return {
    id: uid(),
    type,
    category,
    amount: Math.round(Number(amount) * 100) / 100,
    date,
    note,
    billId,
    ...base(),
  };
}

const transactions = [];

// Every bill payment is also an expense — the seed keeps the ledger honest.
bills.forEach((b) => {
  b.payments.forEach((p) => {
    transactions.push(
      tx({
        category: b.category,
        amount: p.amount,
        date: p.date,
        note: `${b.name} bill`,
        billId: b.id,
      })
    );
  });
});

const currentSpend = [
  { category: 'groceries', amount: 18.4, offset: 0, note: 'Market — greens and eggs' },
  { category: 'eating-out', amount: 4.8, offset: 0, note: 'Coffee at the library' },
  { category: 'transport', amount: 12.5, offset: -1, note: 'Bus top-up' },
  { category: 'eating-out', amount: 14.9, offset: -1, note: 'Lunch with Noor' },
  { category: 'books-study', amount: 28.99, offset: -2, note: 'Design of Everyday Things' },
  { category: 'groceries', amount: 42.6, offset: -2, note: 'Weekly shop' },
  { category: 'health', amount: 9.8, offset: -3, note: 'Pharmacy' },
  { category: 'fun', amount: 16, offset: -3, note: 'Student cinema night' },
  { category: 'transport', amount: 2.75, offset: -4, note: 'Tram to studio' },
  { category: 'groceries', amount: 36.2, offset: -5, note: 'Saturday market' },
];

currentSpend.forEach((s) =>
  transactions.push(
    tx({ category: s.category, amount: s.amount, date: current(s.offset), note: s.note })
  )
);

// Prior week — gives the weekly review something real to compare.
const priorWeekSpend = [
  { category: 'eating-out', amount: 22.5, offset: -6, note: 'Ramen with the cohort' },
  { category: 'transport', amount: 18, offset: -7, note: 'Train card' },
  { category: 'groceries', amount: 38.75, offset: -8, note: 'Corner shop' },
  { category: 'health', amount: 12, offset: -9, note: 'Vitamins' },
  { category: 'fun', amount: 26, offset: -10, note: 'Gallery late night' },
  { category: 'eating-out', amount: 14.8, offset: -11, note: 'Sandwich + soup' },
  { category: 'groceries', amount: 47.9, offset: -12, note: 'Big shop' },
];
priorWeekSpend.forEach((s) =>
  transactions.push(tx({ category: s.category, amount: s.amount, date: addDays(TODAY, s.offset), note: s.note }))
);

// Previous month, spread across the calendar for charts and budget history.
const prevSpend = [
  ['groceries', 54.3, 2, 'Farmers market'],
  ['groceries', 38.75, 5, 'Corner shop'],
  ['eating-out', 22.5, 3, 'Ramen night'],
  ['transport', 28, 4, 'Monthly transit pass top-up'],
  ['fun', 18, 6, 'Film screening'],
  ['eating-out', 36.2, 7, 'Birthday dinner'],
  ['health', 35, 8, 'Prescription'],
  ['groceries', 61.2, 9, 'Big shop'],
  ['transport', 12.5, 10, 'Bus'],
  ['eating-out', 14.8, 11, 'Lunch'],
  ['books-study', 42, 12, 'Bookshop — two titles'],
  ['fun', 26, 13, 'Gallery late night'],
  ['groceries', 47.9, 14, 'Weekly shop'],
  ['eating-out', 28.9, 16, 'Noor’s birthday drinks'],
  ['transport', 34, 17, 'Train to coast'],
  ['groceries', 52.1, 18, 'Weekly shop'],
  ['health', 12, 19, 'Vitamins'],
  ['eating-out', 19.5, 21, 'Takeaway'],
  ['fun', 14, 22, 'Second-hand record'],
  ['groceries', 43.6, 23, 'Weekly shop'],
  ['transport', 15, 24, 'Bus + tram'],
  ['books-study', 18.99, 25, 'Sketchbook'],
  ['eating-out', 31.4, 26, 'Sunday brunch'],
  ['groceries', 58.4, 27, 'Big shop'],
  ['subscriptions', 9.99, 18, 'Streaming subscription'],
];
prevSpend.forEach(([category, amount, day, note]) =>
  transactions.push(
    tx({ category, amount, date: `${LAST_MONTH}-${String(day).padStart(2, '0')}`, note })
  )
);

// Income
transactions.push(
  tx({ type: 'income', category: 'salary', amount: 1980, date: MONTH_START, note: 'Studio — monthly pay' }),
  tx({ type: 'income', category: 'freelance', amount: 320, date: current(-4), note: 'Mural illustration' }),
  tx({ type: 'income', category: 'salary', amount: 1980, date: `${LAST_MONTH}-01`, note: 'Studio — monthly pay' }),
  tx({ type: 'income', category: 'freelance', amount: 320, date: `${LAST_MONTH}-18`, note: 'Editorial illustration' })
);

/* ---- Budgets ------------------------------------------------------------- */

const BUDGET_TEMPLATE = {
  housing: 1000,
  groceries: 340,
  utilities: 160,
  transport: 90,
  'eating-out': 140,
  subscriptions: 25,
  'books-study': 70,
  health: 60,
  fun: 90,
  other: 50,
};

const budgets = [THIS_MONTH, LAST_MONTH, TWO_MONTHS_AGO].flatMap((month) =>
  Object.entries(BUDGET_TEMPLATE).map(([category, limit]) => ({
    id: uid(),
    month,
    category,
    limit,
    ...base(),
  }))
);

/* ---- Habits -------------------------------------------------------------- */

function logObject(offsets, startOffset = 0) {
  const log = {};
  offsets.forEach((o) => {
    log[addDays(TODAY, o)] = true;
  });
  return log;
}

const habits = [
  {
    id: uid(),
    name: 'Morning stretch',
    icon: 'sun',
    tone: 'ochre',
    cadence: 'daily',
    targetPerWeek: 7,
    log: logObject([0, -1, -2, -3, -4, -5, -6, -7, -8, -10, -11, -12, -13, -14, -16, -17, -18, -20]),
    ...base(),
  },
  {
    id: uid(),
    name: 'Walk 20 minutes',
    icon: 'leaf',
    tone: 'sage',
    cadence: 'weekly',
    targetPerWeek: 4,
    log: logObject([0, -1, -3, -5, -7, -9, -11, -12, -14, -16]),
    ...base(),
  },
  {
    id: uid(),
    name: 'Read before bed',
    icon: 'book',
    tone: 'accent',
    cadence: 'weekly',
    targetPerWeek: 5,
    log: logObject([-1, -2, -4, -6, -8, -10, -11, -13, -15]),
    ...base(),
  },
  {
    id: uid(),
    name: 'Water the plants',
    icon: 'sprout',
    tone: 'sage',
    cadence: 'weekly',
    targetPerWeek: 1,
    log: logObject([-2, -9, -16, -23]),
    ...base(),
  },
];

/* ---- Goals --------------------------------------------------------------- */

const goals = [
  {
    id: uid(),
    title: 'Ship the IDP1 prototype',
    note: 'Crit on the 25th. Interfaces, walkthrough, and a short write-up.',
    current: 62,
    target: 100,
    unit: '%',
    targetDate: addDays(TODAY, 21),
    ...base(),
  },
  {
    id: uid(),
    title: 'Read 12 books this year',
    note: 'One a month, slowly. Design, essays, and one very long novel.',
    current: 7,
    target: 12,
    unit: 'books',
    targetDate: `${new Date().getFullYear()}-12-31`,
    ...base(),
  },
  {
    id: uid(),
    title: 'Run 5 km without stopping',
    note: 'Three short runs a week, no pace targets yet.',
    current: 3.2,
    target: 5,
    unit: 'km',
    targetDate: addDays(TODAY, 45),
    ...base(),
  },
  {
    id: uid(),
    title: 'Meditate 50 sessions',
    note: 'Ten minutes counts. So does five.',
    current: 27,
    target: 50,
    unit: 'sessions',
    targetDate: addDays(TODAY, 60),
    ...base(),
  },
];

/* ---- Notifications ------------------------------------------------------- */

const hoursAgo = (h) => new Date(Date.now() - h * 3600 * 1000).toISOString();
const daysAgoTs = (d) => new Date(Date.now() - d * 86400 * 1000).toISOString();

const notifications = [
  {
    id: uid(),
    type: 'bill',
    title: 'Electricity is due today',
    body: '$64.20. Mark it paid when you’re ready and the next date will roll forward.',
    ts: hoursAgo(2),
    read: false,
    link: '#/bills',
    ...base(),
  },
  {
    id: uid(),
    type: 'task',
    title: 'Two things slipped past due',
    body: 'Return the parcel and book the dentist. Both take 15 minutes or less.',
    ts: hoursAgo(20),
    read: false,
    link: '#/tasks',
    ...base(),
  },
  {
    id: uid(),
    type: 'budget',
    title: 'Last month’s eating-out ran over',
    body: 'You spent $153 of $140. This month’s budget is reset — no lecture attached.',
    ts: hoursAgo(30),
    read: false,
    link: '#/money',
    ...base(),
  },
  {
    id: uid(),
    type: 'bill',
    title: 'Rent recorded',
    body: '$980 paid on the 1st. Next due in 27 days.',
    ts: daysAgoTs(3),
    read: true,
    link: '#/bills',
    ...base(),
  },
  {
    id: uid(),
    type: 'system',
    title: 'Last week’s review, revisited',
    body: 'A look back at the week, and two gentle suggestions for the next one.',
    ts: daysAgoTs(2),
    read: true,
    link: '#/review',
    ...base(),
  },
  {
    id: uid(),
    type: 'system',
    title: 'Puffy has a plan for today',
    body: 'Five blocks, two bills, and one proper break in the middle.',
    ts: hoursAgo(1),
    read: false,
    link: '#/planner',
    ...base(),
  },
];

/* ---- Check-ins ----------------------------------------------------------- */

const moods = [
  { offset: -5, mood: 3 },
  { offset: -4, mood: 4 },
  { offset: -3, mood: 2 },
  { offset: -2, mood: 3 },
  { offset: -1, mood: 5 },
  { offset: 0, mood: 4 },
];

const checkins = moods.map((m) => ({
  date: addDays(TODAY, m.offset),
  mood: m.mood,
  note: '',
  ...base(),
}));

/* ---- Profile ------------------------------------------------------------- */

const profile = {
  id: 'me',
  name: 'Maya Chen',
  email: 'maya.chen@example.com',
  accent: 'terracotta',
  mascotStyle: 'slate',
  mascotForm: 'lantern',
  theme: 'auto',
  workStart: '09:00',
  workEnd: '17:30',
  aiOn: true,
  notificationsOn: false,
  notifyBills: true,
  notifyTasks: true,
  notifyBudgets: true,
  notifyReview: true,
  remindDaysBefore: 3,
  onboarded: false,
  ...base(),
};

export function buildDemoData() {
  return {
    profile: { ...profile, createdAt: STAMP, updatedAt: STAMP },
    tasks: tasks.map((t) => ({ ...t })),
    bills: bills.map((b) => ({ ...b })),
    transactions: transactions.map((t) => ({ ...t })),
    budgets: budgets.map((b) => ({ ...b })),
    habits: habits.map((h) => ({ ...h })),
    goals: goals.map((g) => ({ ...g })),
    notifications: notifications.map((n) => ({ ...n })),
    checkins: checkins.map((c) => ({ ...c })),
  };
}

export const DEMO_META = {
  persona: 'Maya Chen',
  currency: 'USD',
  seededAt: STAMP,
  today: TODAY,
};
