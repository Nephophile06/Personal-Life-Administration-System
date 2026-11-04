/**
 * Thin IndexedDB wrapper. Only api.js is allowed to import this module —
 * pages talk to api.js so the future JSP/Oracle backend can slot in.
 */

const DB_NAME = 'pip-life-admin';
const DB_VERSION = 1;

export const STORES = {
  profile: 'profile',
  tasks: 'tasks',
  bills: 'bills',
  transactions: 'transactions',
  budgets: 'budgets',
  habits: 'habits',
  goals: 'goals',
  notifications: 'notifications',
  checkins: 'checkins',
  plans: 'plans',
  syncQueue: 'syncQueue',
  meta: 'meta',
};

let dbPromise = null;

function upgrade(db) {
  if (!db.objectStoreNames.contains(STORES.profile)) {
    db.createObjectStore(STORES.profile, { keyPath: 'id' });
  }
  if (!db.objectStoreNames.contains(STORES.tasks)) {
    const s = db.createObjectStore(STORES.tasks, { keyPath: 'id' });
    s.createIndex('due', 'due');
    s.createIndex('done', 'done');
    s.createIndex('order', 'order');
  }
  if (!db.objectStoreNames.contains(STORES.bills)) {
    const s = db.createObjectStore(STORES.bills, { keyPath: 'id' });
    s.createIndex('nextDue', 'nextDue');
  }
  if (!db.objectStoreNames.contains(STORES.transactions)) {
    const s = db.createObjectStore(STORES.transactions, { keyPath: 'id' });
    s.createIndex('date', 'date');
    s.createIndex('category', 'category');
    s.createIndex('type', 'type');
  }
  if (!db.objectStoreNames.contains(STORES.budgets)) {
    const s = db.createObjectStore(STORES.budgets, { keyPath: 'id' });
    s.createIndex('month', 'month');
  }
  if (!db.objectStoreNames.contains(STORES.habits)) {
    db.createObjectStore(STORES.habits, { keyPath: 'id' });
  }
  if (!db.objectStoreNames.contains(STORES.goals)) {
    db.createObjectStore(STORES.goals, { keyPath: 'id' });
  }
  if (!db.objectStoreNames.contains(STORES.notifications)) {
    const s = db.createObjectStore(STORES.notifications, { keyPath: 'id' });
    s.createIndex('ts', 'ts');
    s.createIndex('read', 'read');
  }
  if (!db.objectStoreNames.contains(STORES.checkins)) {
    db.createObjectStore(STORES.checkins, { keyPath: 'date' });
  }
  if (!db.objectStoreNames.contains(STORES.plans)) {
    db.createObjectStore(STORES.plans, { keyPath: 'date' });
  }
  if (!db.objectStoreNames.contains(STORES.syncQueue)) {
    const s = db.createObjectStore(STORES.syncQueue, { keyPath: 'id' });
    s.createIndex('ts', 'ts');
  }
  if (!db.objectStoreNames.contains(STORES.meta)) {
    db.createObjectStore(STORES.meta, { keyPath: 'key' });
  }
}

export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB is not available in this browser.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => upgrade(req.result);
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Database upgrade is blocked by another tab.'));
  });
  return dbPromise;
}

function request(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function done(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
  });
}

export async function get(store, key) {
  const db = await openDB();
  return request(db.transaction(store, 'readonly').objectStore(store).get(key));
}

export async function getAll(store) {
  const db = await openDB();
  return request(db.transaction(store, 'readonly').objectStore(store).getAll());
}

export async function getAllByIndex(store, index, value) {
  const db = await openDB();
  return request(db.transaction(store, 'readonly').objectStore(store).index(index).getAll(value));
}

export async function put(store, value) {
  const db = await openDB();
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).put(value);
  await done(tx);
  return value;
}

export async function putMany(store, values = []) {
  if (!values.length) return [];
  const db = await openDB();
  const tx = db.transaction(store, 'readwrite');
  const os = tx.objectStore(store);
  values.forEach((v) => os.put(v));
  await done(tx);
  return values;
}

export async function remove(store, key) {
  const db = await openDB();
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).delete(key);
  await done(tx);
}

export async function clear(store) {
  const db = await openDB();
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).clear();
  await done(tx);
}

export async function clearMany(stores) {
  if (!stores.length) return;
  const db = await openDB();
  const tx = db.transaction(stores, 'readwrite');
  stores.forEach((s) => tx.objectStore(s).clear());
  await done(tx);
}

export async function count(store) {
  const db = await openDB();
  return request(db.transaction(store, 'readonly').objectStore(store).count());
}
