# Puffy — Personal Life Administration System

A calm, local-first home for tasks, bills, budgets, habits, goals and the shape of your day. Built for **IDP1** as a complete, installable frontend with no server, no account and no cloud.

Plain **HTML, CSS and JavaScript (ES modules)**. No framework, no bundler, no build step. Open it through any static server and it runs.

---

## Run it

From the project root:

```bash
npm run dev
# or: cd pla-frontend && npx serve . -l 4173
# or: cd pla-frontend && python -m http.server 4173
```

Open <http://localhost:4173>. Choose **Continue as demo user** to enter a fully seeded week for Maya Chen (114 records across tasks, bills, expenses, habits, goals, check-ins and notifications).

> The service worker, install prompt and notifications need `localhost` or HTTPS. Opening `index.html` as a `file://` URL still renders the app but cannot go offline.

To reset the demo week at any time: **Settings → A clean slate → Reset demo data**. Name, palette, hours and Puffy's form and colour survive the reset.

---

## The screens

| Screen | Route | Notes |
| --- | --- | --- |
| Welcome / Login / Register | `#/welcome` | Local-only "auth"; no password |
| Dashboard | `#/dashboard` | Mood check-in, today's plan, money and habit snapshots |
| Tasks | `#/tasks` | List and board views, drag order, Puffy's order, score breakdown, activity history |
| Daily planner | `#/planner` | Scored plan, editable weights, free slots, accept/regenerate |
| Bills | `#/bills` | Upcoming, paid, frequency, per-bill reminder window, payment history |
| Expenses & budgets | `#/money` | Month switcher, category donut, daily rhythm, budget ledger, 80/100% alerts |
| Habits & goals | `#/habits` | Weekly rhythm, animated streaks, progress rings |
| Weekly review | `#/review` | Tasks, money, habits, goals, Puffy's notes |
| Leisure | `#/leisure` | Six offline games — Quiet pairs, Lantern grid, Three by three, Letter trail, One of these, Next in line — 36 levels each, first six free, local Plus unlock |
| Notifications | `#/notifications` | Bill/task/budget/review reminders, browser opt-in, test notification |
| Profile & Settings | `#/settings` | Profile, accent/theme/Puffy, hours, nudges, CSV export, install |

---

## Folder map

```
Personal-Life-Administration-System/
├─ README.md
├─ pla-frontend/                 ← the app (this is what you serve)
│  ├─ index.html                 app shell, theme boot script, manifest + module preloads
│  ├─ manifest.webmanifest       name, icons, shortcuts, screenshots, standalone display
│  ├─ sw.js                      offline shell, Chart.js cache, Background Sync, notifications
│  ├─ offline.html               standalone offline fallback
│  ├─ assets/
│  │  ├─ css/app.css             one stylesheet: tokens → base → layout → components → pages
│  │  ├─ fonts/                  Fraunces + Instrument Sans (local woff2)
│  │  ├─ icons/                  any + maskable PNGs, apple-touch-icon
│  │  ├─ screenshots/            manifest install previews
│  │  └─ js/
│  │     ├─ app.js               shell, navigation, boot, install prompt, theme toggle
│  │     ├─ api.js               THE data boundary (see contract below)
│  │     ├─ store.js             thin IndexedDB wrapper, imported only by api.js
│  │     ├─ router.js            hash router with lazy page modules
│  │     ├─ theme.js             accent + light/dark/auto persistence
│  │     ├─ mascot.js            Puffy illustrations, four forms, colourways, glyph
│  │     ├─ planner.js           pure scoring + time-block generation
│  │     ├─ leisure-data.js      curated prompts plus board generators for six games (offline)
│  │     ├─ analytics.js         streaks, budget levels, weekly review
│  │     ├─ constants.js         categories, priorities, frequencies
│  │     ├─ pwa.js               SW registration, install, notifications, sync handshake
│  │     ├─ pages/               one module per screen (default export render(root, ctx))
│  │     └─ ui/                  format, sheet, toast, charts, csv, widgets
│  └─ seed/demo-data.js          date-relative demo week
└─ qa/                           Playwright audits, Lighthouse JSON, screenshots
```

---

## Data contract (`assets/js/api.js`)

**All** record access goes through `api.js`. Pages never import `store.js` or touch IndexedDB, and never call `fetch` for records. That is the seam a backend will replace.

Every record carries:

```js
{
  id: "crypto.randomUUID()",
  updatedAt: "2026-11-05T09:14:02.000Z",
  synced: false,
  ...domain fields
}
```

Every create/update/delete also appends to the `syncQueue` store:

```js
{ id, entity: "task", op: "update", payload: { ...record }, ts: 1762324442000 }
```

Dates are local `YYYY-MM-DD` strings, money is USD in numbers, and the profile is a singleton with `id: "me"`. The profile also carries notification preferences (`notifyBills`, `notifyTasks`, `notifyBudgets`, `notifyReview`, `remindDaysBefore`), while each bill may override the lead window with its own `remindDaysBefore`. Tasks keep a capped `history` array of `{ id, ts, type, text }` entries (FR-20). Leisure lives in a single local `meta:leisure` record: per-game tallies (`plays`, `wins`, best moves/misses, perfect boards), progression (`level`, `cleared`, 1–36), and `premium: { unlocked, since, source }`. Finishing a board advances `level` and grows `cleared`; board content is generated from those numbers, so no level layout is stored. No game result ever leaves the device. The Plus flag is a demo entitlement, not a payment record.

### Function → future endpoint

Each function has a `// BACKEND:` comment in `api.js` naming the endpoint it will call. Signatures and return shapes are the contract.

| Profile & app | Endpoint |
| --- | --- |
| `getProfile()` | `GET /api/profile` |
| `saveProfile(patch)` | `PUT /api/profile` |
| `completeOnboarding(patch)` | `POST /api/onboarding` |
| `resetDemoData()` | `POST /api/demo/reset` |
| `getDataStats()` | `GET /api/stats` |
| `getExportData()` | `GET /api/export` |

| Tasks | Endpoint |
| --- | --- |
| `getTasks({includeDone})` | `GET /api/tasks` |
| `getTask(id)` | `GET /api/tasks/:id` |
| `saveTask(task)` | `POST /api/tasks` / `PUT /api/tasks/:id` |
| `deleteTask(id)` | `DELETE /api/tasks/:id` |
| `toggleTask(id, done)` | `PATCH /api/tasks/:id` |
| `reorderTasks(ids)` | `PUT /api/tasks/reorder` |

| Bills | Endpoint |
| --- | --- |
| `getBills()` | `GET /api/bills` |
| `saveBill(bill)` | `POST /api/bills` / `PUT /api/bills/:id` |
| `deleteBill(id)` | `DELETE /api/bills/:id` |
| `getPayments(billId)` | `GET /api/bills/:id/payments` |
| `markBillPaid(id, date)` | `POST /api/bills/:id/payments` |

| Money | Endpoint |
| --- | --- |
| `getExpenses(month)` | `GET /api/expenses?month=YYYY-MM` |
| `getIncome(month)` | `GET /api/income?month=YYYY-MM` |
| `getTransactions(month)` | `GET /api/transactions?month=YYYY-MM` |
| `saveTransaction(tx)` | `POST /api/expenses` / `PUT /api/expenses/:id` |
| `deleteTransaction(id)` | `DELETE /api/expenses/:id` |
| `getBudgets(month)` | `GET /api/budgets?month=YYYY-MM` |
| `saveBudget(budget)` | `PUT /api/budgets/:month/:category` |
| `deleteBudget(id)` | `DELETE /api/budgets/:id` |
| `getMoneyOverview(month)` | `GET /api/money/overview?month=YYYY-MM` |
| `getSpendingTrend(days)` | `GET /api/expenses/trend?days=14` |
| `getSpentBetween(from, to)` | `GET /api/expenses/range?from=&to=` |
| `getTransactionsBetween(from, to)` | `GET /api/transactions/range?from=&to=` |
| `generateBudgetAlerts(month)` | `POST /api/notifications/budget-alerts?month=YYYY-MM` |

| Habits, goals & check-ins | Endpoint |
| --- | --- |
| `getHabits()` | `GET /api/habits` |
| `saveHabit(habit)` | `POST /api/habits` / `PUT /api/habits/:id` |
| `deleteHabit(id)` | `DELETE /api/habits/:id` |
| `toggleHabit(id, date)` | `PUT /api/habits/:id/checkins/:date` |
| `getGoals()` | `GET /api/goals` |
| `saveGoal(goal)` | `POST /api/goals` / `PUT /api/goals/:id` |
| `deleteGoal(id)` | `DELETE /api/goals/:id` |
| `getCheckin(date)` | `GET /api/checkins/:date` |
| `getCheckins(from, to)` | `GET /api/checkins?from=&to=` |
| `saveCheckin(date, mood)` | `PUT /api/checkins/:date` |

| Planner | Endpoint |
| --- | --- |
| `generatePlan(date, opts)` | `POST /api/plan/generate` |
| `getPlan(date)` | `GET /api/plan?date=YYYY-MM-DD` |
| `getOrCreatePlan(date)` | `GET /api/plan/today` |
| `acceptPlan(date)` | `POST /api/plan/:date/accept` |
| `rejectPlan(date)` | `POST /api/plan/:date/reject` |
| `updatePlanBlocks(date, blocks)` | `PUT /api/plan/:date/blocks` |
| `askLLM(input)` | `POST /api/plan/ai` (stub → returns `null`) |

| Notifications, review, export, sync | Endpoint |
| --- | --- |
| `getNotifications()` | `GET /api/notifications` |
| `addNotification(n)` | `POST /api/notifications` |
| `markNotificationRead(id, read)` | `PATCH /api/notifications/:id/read` |
| `markAllNotificationsRead()` | `PATCH /api/notifications/read-all` |
| `deleteNotification(id)` | `DELETE /api/notifications/:id` |
| `generateReminders(date)` | `POST /api/notifications/generate` |
| `getUnreadCount()` | `GET /api/notifications/unread-count` |
| `getWeeklyReview(date)` | `GET /api/review/week?date=YYYY-MM-DD` |
| `getLeisureState()` | `GET /api/leisure` |
| `saveLeisureState(patch)` | `PUT /api/leisure` |
| `getTasksForExport()` | `GET /api/export/tasks` |
| `getExpensesForExport(from, to)` | `GET /api/export/expenses?from=&to=` |
| `getAllForExport()` | `GET /api/export/all` |
| `flushQueue()` | `POST /api/sync` |

### Backend hand-off

1. Keep every exported name and argument list in `api.js`; replace the body with `fetch`.
2. Return the same record shapes (including `id`, `updatedAt`, `synced`). The server owns `synced: true`.
3. Keep the profile as a singleton addressed as `id: "me"`, or introduce a real user id and map it in one place.
4. Replay `syncQueue` at `POST /api/sync` with `{ id, entity, op, payload, ts }` entries and acknowledge ids so `flushQueue()` can clear them.
5. Delete `seedAll()` and the demo-data import when the backend is live; the UI already treats an empty week gracefully.
6. The service worker's `sync` handler (`pla-sync`) posts `PLA_QUEUE_FLUSH` to open windows; point `flushQueue()` at the new endpoint and the existing offline flow completes itself.
7. Replace the demo Plus unlock with a verified entitlement. `saveLeisureState({ premium })` currently trusts the client; a real server should return the entitlement from a purchase record and `GET /api/leisure` should be the only source of `premium.unlocked`. Keep the client-side free-level clamp as a UI courtesy, not as the paywall.

---

## PWA behaviour

- **Installable** — manifest with 192/512 any + maskable icons, shortcuts, install screenshots, standalone display. Install prompt is captured in `app.js`; Settings explains the manual path when the browser does not offer it.
- **Offline shell** — `sw.js` precaches every module, stylesheet, font, icon and the pinned Chart.js URL (`4.4.7`). Navigations are network-first with a 3.5 s timeout and fall back to the cached shell, then `offline.html`; assets use stale-while-revalidate; fonts/icons/Chart.js are cache-first.
- **Offline chip** — appears in the top bar whenever `navigator.onLine` is false.
- **Background Sync** — every local mutation emits `pla:queued`; `pwa.js` registers the `pla-sync` tag, and the worker asks open windows to flush when connectivity returns. Headless Chromium disables the platform feature, but the handshake and queue are testable via `PLA_SYNC_NOW`.
- **Notifications** — opt-in on the Notifications screen; test and reminder notifications go through `registration.showNotification` so they work with the tab closed where the browser allows it.
- **Updates** — bump `VERSION` at the top of `sw.js` after changing precached files. A waiting worker triggers an in-app toast.

---

## Design & accessibility

- **Warm Ledger** tokens: paper, ink, one accent, soft rules and ledger cells. No default-font look, no purple gradients, no emoji icons.
- Five accent presets, three theme modes (light / dark / auto), four Puffy forms (lantern, moth, pebble, coffee), four colourways (slate, sage, clay rose, ochre), initials or Puffy avatar.
- Local variable fonts: Fraunces (display) and Instrument Sans (body).
- Semantic landmarks, one `h1` per screen, skip link, visible `:focus-visible` rings, labelled controls, `aria-live` toasts, native `<dialog>` sheets with Escape handling, `prefers-reduced-motion` and `prefers-color-scheme`.
- AA contrast and ARIA checked with Lighthouse and axe-core on every screen in light and dark (100 accessibility, zero WCAG A/AA violations).
- Leisure is deliberately quiet: no timers, scores or interruptions, six keyboard-operable games with six free levels each, generated boards that grow with the level, tokens for light/dark, and motion that stops under `prefers-reduced-motion`.

---

## QA

The `qa/` folder holds Playwright audits and screenshots. With the static server running on `127.0.0.1:4173`:

```bash
cd qa
npm install
node phase8.mjs          # settings, export, reset
node phase9.mjs          # manifest, SW cache, offline, sync, notifications
node phase10-layout.mjs  # every screen and game route × 360/768/1280 × light/dark
node leisure.mjs         # plays all six games, levels, Plus gate/unlock, persistence, offline
node leisure-layout.mjs  # hub + six games × 360/768/1280 × light/dark
node leisure-advanced.mjs  # Plus level-36 boards at phone and tablet, light/dark
node leisure-generators.mjs  # 25 generated boards per level, plus level-36 DOM checks
node check-coffee-logout.mjs  # Puffy form/colour pickers, logout + route guard
node check-proposal-gaps.mjs  # reminder prefs, task history, Puffy scores, budget/review nudges, streaks
node axe-check.mjs       # WCAG A/AA scan on every screen and game × light/dark (loads axe-core from CDN)
```

Lighthouse (Chrome must be installed). Serve with compression — `npx serve` does; Python's `http.server` does not, and uncompressed CSS depresses the mobile score:

```bash
npx lighthouse http://127.0.0.1:4173/ --output=json --output-path=./lighthouse-mobile.json
npx lighthouse@11.7.1 http://127.0.0.1:4173/ --only-categories=pwa --output=json --output-path=./lighthouse-pwa.json
```

Latest results on this machine (gzip-enabled static server):

| Profile | Performance | Accessibility | Best practices | SEO | PWA |
| --- | --- | --- | --- | --- | --- |
| Mobile (Lighthouse 13) | 98 | 100 | 100 | 100 | 100* |
| Desktop | 100 | 100 | 100 | 100 | 100* |

\* Lighthouse 12+ removed the PWA category; the PWA score above is from Lighthouse 11.7.1 against the same build.

Layout audit: **102 screen/theme combinations** (welcome + every screen and six game routes × 3 widths × 2 themes) with zero horizontal overflow and zero console errors. Leisure audit: **12 functional checks** across all six games (every level-1 board finished, levels saved, reload persistence, locked-level clamp, Plus gate → demo unlock → level 7, offline trail tap) plus **71 layout checks** covering the hub, first boards, level-36 Plus boards, and the phone gate in light and dark. A generator audit folds 25 boards per level across all 36 levels and checks level-36 DOM boards (trail words present, lantern masks solvable, options unique).

---

## Known limits

- No backend, account or password: data is local to the browser and profile.
- Puffy Plus is a local demo unlock. No card, account or payment is collected, and clearing site data clears the entitlement along with progress.
- Demo data is seeded on first entry, not on page load, so the welcome screen stays light.
- Background Sync and install prompts vary by browser; Safari/iOS uses Share → Add to Home Screen and does not support Background Sync.
- Chart.js is the only third-party dependency, pinned and cached by the service worker.
