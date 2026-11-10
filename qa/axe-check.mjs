import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: 'chromium' });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'light' });
const page = await context.newPage();
await page.goto('http://127.0.0.1:4173/#/welcome', { waitUntil: 'networkidle' });
await page.locator('[data-demo]').click();
await page.waitForTimeout(700);

const routes = [
  'dashboard',
  'tasks',
  'planner',
  'bills',
  'money',
  'habits',
  'review',
  'leisure',
  'leisure?game=pairs',
  'leisure?game=lantern',
  'leisure?game=words',
  'leisure?game=trail',
  'leisure?game=odd',
  'leisure?game=pattern',
  'notifications',
  'settings',
];

async function scan(label) {
  await page.addScriptTag({ url: 'https://cdn.jsdelivr.net/npm/axe-core@4.10.2/axe.min.js' });
  const result = await page.evaluate(async () => {
    const r = await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'], resultTypes: ['violations'] });
    return r.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      nodes: v.nodes.slice(0, 4).map((n) => n.target.join(' ')),
      count: v.nodes.length,
    }));
  });
  if (!result.length) return 0;
  console.log(`\n[${label}]`);
  for (const v of result) {
    console.log(v.impact, v.id, `x${v.count}`, '|', v.help, '|', v.nodes.join(' ; '));
  }
  return result.length;
}

let violations = 0;
for (const theme of ['light', 'dark']) {
  await page.emulateMedia({ colorScheme: theme });
  for (const route of routes) {
    await page.goto(`http://127.0.0.1:4173/#/${route}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(900);
    violations += await scan(`${theme}/${route}`);
  }
}

/* Plus gate and unlock sheet, once, in light mode. */
await page.emulateMedia({ colorScheme: 'light' });
await page.evaluate(async () => {
  const api = await import('/assets/js/api.js');
  await api.saveLeisureState({ pairs: { level: 6, cleared: 5 } });
});
await page.goto('http://127.0.0.1:4173/#/leisure?game=pairs', { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
const labels = await page.$$eval('.pair-card', (els) =>
  els.map((el) => el.querySelector('.pair-card__front span')?.textContent.trim())
);
const byLabel = new Map();
labels.forEach((label, index) => {
  if (!byLabel.has(label)) byLabel.set(label, []);
  byLabel.get(label).push(index);
});
for (const indices of byLabel.values()) {
  for (const index of indices) await page.locator(`[data-pair="${index}"]`).click();
  await page.waitForTimeout(560);
}
await page.waitForSelector('.leisure-gate');
await page.waitForTimeout(500);
violations += await scan('light/leisure-gate');
await page.locator('.leisure-result [data-unlock]').click();
await page.waitForSelector('#sheet-title');
await page.waitForTimeout(500);
violations += await scan('light/leisure-plus-sheet');

console.log(`\naxe complete — ${violations} violation group(s)`);
await browser.close();
if (violations) process.exit(1);
