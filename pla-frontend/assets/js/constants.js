/** Shared vocabulary used by seed data, API and UI. */

export const TASK_CATEGORIES = [
  { id: 'study', label: 'Study', icon: 'book', tone: 'ochre' },
  { id: 'work', label: 'Work', icon: 'briefcase', tone: 'accent' },
  { id: 'home', label: 'Home', icon: 'house', tone: 'sage' },
  { id: 'health', label: 'Health', icon: 'heart', tone: 'rose' },
  { id: 'finance', label: 'Finance', icon: 'card', tone: 'indigo' },
  { id: 'personal', label: 'Personal', icon: 'user', tone: 'muted' },
];

export const PRIORITIES = [
  { id: 'high', label: 'High', tone: 'danger', rank: 3 },
  { id: 'medium', label: 'Medium', tone: 'ochre', rank: 2 },
  { id: 'low', label: 'Low', tone: 'sage', rank: 1 },
];

export const EXPENSE_CATEGORIES = [
  { id: 'housing', label: 'Housing', icon: 'house', tone: 'accent' },
  { id: 'groceries', label: 'Groceries', icon: 'cart', tone: 'sage' },
  { id: 'utilities', label: 'Utilities', icon: 'bolt', tone: 'ochre' },
  { id: 'transport', label: 'Transport', icon: 'car', tone: 'indigo' },
  { id: 'eating-out', label: 'Eating out', icon: 'coffee', tone: 'rose' },
  { id: 'subscriptions', label: 'Subscriptions', icon: 'repeat', tone: 'accent' },
  { id: 'books-study', label: 'Books & study', icon: 'book', tone: 'ochre' },
  { id: 'health', label: 'Health', icon: 'heart', tone: 'sage' },
  { id: 'fun', label: 'Fun', icon: 'sparkles', tone: 'rose' },
  { id: 'other', label: 'Other', icon: 'tag', tone: 'muted' },
];

export const INCOME_CATEGORIES = [
  { id: 'salary', label: 'Salary', icon: 'briefcase' },
  { id: 'freelance', label: 'Freelance', icon: 'wand' },
  { id: 'gift', label: 'Gift', icon: 'heart' },
  { id: 'other-income', label: 'Other', icon: 'tag' },
];

export const BILL_KINDS = [
  { id: 'rent', label: 'Rent', icon: 'house', category: 'housing' },
  { id: 'electricity', label: 'Electricity', icon: 'bolt', category: 'utilities' },
  { id: 'gas', label: 'Gas', icon: 'flame', category: 'utilities' },
  { id: 'water', label: 'Water', icon: 'droplet', category: 'utilities' },
  { id: 'internet', label: 'Internet', icon: 'wifi-off', category: 'utilities' },
  { id: 'phone', label: 'Phone', icon: 'card', category: 'utilities' },
  { id: 'custom', label: 'Custom', icon: 'receipt', category: 'other' },
];

export const FREQUENCIES = [
  { id: 'weekly', label: 'Weekly', days: 7 },
  { id: 'monthly', label: 'Monthly', months: 1 },
  { id: 'quarterly', label: 'Quarterly', months: 3 },
  { id: 'yearly', label: 'Yearly', months: 12 },
];

export const GOAL_UNITS = ['%', 'hours', 'books', 'km', 'sessions'];

export const categoryMeta = (id) =>
  [...TASK_CATEGORIES, ...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES].find((c) => c.id === id) || {
    id,
    label: id,
    icon: 'tag',
    tone: 'muted',
  };

export const priorityMeta = (id) =>
  PRIORITIES.find((p) => p.id === id) || { id, label: id, tone: 'muted', rank: 0 };

export const billKind = (id) => BILL_KINDS.find((k) => k.id === id) || BILL_KINDS.at(-1);
