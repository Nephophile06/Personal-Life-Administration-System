import { pageHead } from '../ui/widgets.js';
import { icon } from '../icons.js';
import { seedScene } from '../illustrations.js';

/**
 * Temporary phase-1 workshop page. Replaced screen by screen in later phases.
 */
export function stubPage({
  title,
  eyebrow = 'The shell, built',
  sub = '',
  next = 'This page is next on the workbench.',
  detail = '',
  points = [],
  actions = '',
}) {
  return `
  <section class="page">
    ${pageHead({ eyebrow, title, sub, actions })}

    <div class="stub-hero card">
      <div>
        <span class="tag tag--accent">${icon('sparkles', 12)} Phase 1 · frame ready</span>
        <h2>${next}</h2>
        <p>${detail || 'The paper, type, navigation and theme are in place. This screen will be drawn on top of it next, with real local data and Puffy keeping an eye on things.'}</p>
        <ul class="stub-checks">
          <li><span class="done">${icon('check-circle', 15)}</span> Design tokens &amp; paper surfaces</li>
          <li><span class="done">${icon('check-circle', 15)}</span> Sidebar, phone tabs &amp; hash router</li>
          <li><span class="done">${icon('check-circle', 15)}</span> Light / dark / accent switching</li>
          ${points.map((p) => `<li><span class="muted">${icon('circle', 15)}</span> ${p}</li>`).join('')}
        </ul>
      </div>
      <div class="stub-hero__art">${seedScene()}</div>
    </div>

    <div class="grid grid-3 stub-cards page-section">
      <div class="card">
        <span class="num">01</span>
        <h3>Keep it local</h3>
        <p>IndexedDB with seeded demo data, exposed only through <span class="mono">api.js</span>.</p>
      </div>
      <div class="card">
        <span class="num">02</span>
        <h3>Make it yours</h3>
        <p>Your accent, your hours, your mascot — stored with the rest of your profile.</p>
      </div>
      <div class="card">
        <span class="num">03</span>
        <h3>Work offline</h3>
        <p>Installable, cached, and honest about it. A small chip tells you when you are offline.</p>
      </div>
    </div>
  </section>`;
}
