import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: 'chromium' });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'light' });
const page = await context.newPage();
await page.goto('http://127.0.0.1:4173/#/welcome', { waitUntil: 'networkidle' });
await page.locator('[data-demo]').click();
await page.waitForTimeout(700);

const routes = ['dashboard', 'tasks', 'planner', 'bills', 'money', 'habits', 'review', 'notifications', 'settings'];
for (const theme of ['light', 'dark']) {
  await page.emulateMedia({ colorScheme: theme });
  for (const route of routes) {
    await page.goto(`http://127.0.0.1:4173/#/${route}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(900);
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
    if (result.length) {
      console.log(`\n[${theme}/${route}]`);
      for (const v of result) console.log(v.impact, v.id, `x${v.count}`, '|', v.help, '|', v.nodes.join(' ; '));
    }
  }
}
console.log('\naxe complete');
await browser.close();
