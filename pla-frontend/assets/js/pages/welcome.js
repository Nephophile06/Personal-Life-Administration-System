import { icon } from '../icons.js';
import { pipGlyph } from '../mascot.js';
import { welcomeScene } from '../illustrations.js';
import { greeting, initials, esc } from '../ui/format.js';
import { navigate } from '../router.js';

/**
 * Welcome / local sign-in / local register.
 * There is no server and no password: "signing in" selects the profile already
 * stored in this browser, and registering simply names it.
 */
export default function welcome(root, ctx) {
  const profile = ctx.getProfile() || {};
  const g = greeting();
  const name = profile.name || 'Maya Chen';
  const firstName = name.split(' ')[0];
  const email = profile.email || '';

  root.innerHTML = `
    <div class="welcome">
      <section class="welcome__art" aria-hidden="true">
        <div class="welcome__scene">${welcomeScene(g.period)}</div>
        <div class="welcome__quote">
          <span class="eyebrow eyebrow--plain">Puffy says</span>
          <p class="serif">“${g.line}”</p>
        </div>
        <ul class="welcome__truths">
          <li>${icon('lock', 13)} Stored on this device</li>
          <li>${icon('wifi-off', 13)} No account needed</li>
          <li>${icon('leaf', 13)} One thing at a time</li>
        </ul>
      </section>

      <section class="welcome__copy">
        <a class="brand welcome__brand" href="#/welcome">
          <span class="brand__mark">${pipGlyph(23)}</span>
          <span>
            <span class="brand__word">Puffy</span>
            <span class="brand__sub">Life admin</span>
          </span>
        </a>

        <div class="welcome__body">
          <span class="eyebrow">A calmer week starts here</span>
          <h1>Everything life<br>asks of you,<br><em>in one place.</em></h1>
          <p class="lede">Tasks, bills, budgets, habits and a plan for the day — kept on paper-soft screens, on this device, without an account.</p>

          <div class="auth" data-auth>
            <div class="auth__tabs" role="group" aria-label="Welcome options">
              <button class="auth__tab" type="button" data-auth-tab="new" aria-pressed="true" aria-controls="auth-new">New desk</button>
              <button class="auth__tab" type="button" data-auth-tab="returning" aria-pressed="false" aria-controls="auth-returning">Sign in</button>
            </div>

            <div class="auth__panel" id="auth-new" data-panel="new">
              <form class="auth__form" data-signup novalidate>
                <div class="field">
                  <label for="signup-name">What should Puffy call you?</label>
                  <input class="input" id="signup-name" name="name" autocomplete="name" maxlength="40" placeholder="e.g. Maya Chen" required>
                </div>
                <div class="field">
                  <label for="signup-email">Email <span class="muted">(optional, stays here)</span></label>
                  <input class="input" id="signup-email" name="email" type="email" autocomplete="email" maxlength="80" placeholder="you@example.com">
                </div>
                <p class="auth__error" data-auth-error role="alert"></p>
                <button class="btn btn--primary btn--lg btn--block" type="submit" data-signup-submit>
                  Make my desk ${icon('arrow-right', 17)}
                </button>
                <p class="auth__note tiny muted">${icon('info', 13)} No password, no account. Your desk lives in this browser.</p>
              </form>
            </div>

            <div class="auth__panel" id="auth-returning" data-panel="returning" hidden>
              <div class="auth__local">
                <span class="avatar avatar--lg" aria-hidden="true">${initials(name)}</span>
                <span class="auth__local-meta">
                  <strong>${esc(name)}</strong>
                  <small>${email ? esc(email) : 'Saved on this device'}</small>
                  <small class="auth__local-note">${icon('check-circle', 12)} Found a desk on this browser</small>
                </span>
              </div>
              <button class="btn btn--primary btn--lg btn--block" type="button" data-return>
                Open ${esc(firstName)}’s desk ${icon('arrow-right', 17)}
              </button>
              <p class="auth__note tiny muted">Not ${esc(firstName)}? <button class="linkish" type="button" data-auth-tab="new">Use a different name</button>.</p>
            </div>
          </div>

          <div class="welcome__alt">
            <span class="tiny muted">Just looking?</span>
            <button class="btn btn--ghost btn--sm" type="button" data-demo>
              Continue as demo user ${icon('arrow-right', 15)}
            </button>
          </div>
        </div>

        <footer class="welcome__foot">
          <span class="tag tag--accent">Local-first</span>
          <span class="tiny muted">No account, no password. Nothing leaves this browser.</span>
        </footer>
      </section>
    </div>
  `;

  const auth = root.querySelector('[data-auth]');
  const panels = root.querySelectorAll('[data-panel]');
  const tabs = root.querySelectorAll('[data-auth-tab]');
  const error = root.querySelector('[data-auth-error]');
  const signup = root.querySelector('[data-signup]');
  const submit = root.querySelector('[data-signup-submit]');
  const nameInput = root.querySelector('#signup-name');

  function setMode(mode) {
    auth.dataset.mode = mode;
    tabs.forEach((tab) => tab.setAttribute('aria-pressed', String(tab.dataset.authTab === mode)));
    panels.forEach((panel) => {
      panel.hidden = panel.dataset.panel !== mode;
    });
    if (error) error.textContent = '';
    if (mode === 'new') nameInput?.focus();
  }

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      if (tab.dataset.authTab === 'new' && !tab.closest('[data-panel]')) {
        setMode('new');
      } else {
        setMode(tab.dataset.authTab);
      }
    });
  });

  nameInput?.addEventListener('input', () => {
    if (error) error.textContent = '';
  });

  const enter = async (button, message, patch = {}) => {
    if (button?.disabled) return;
    if (button) {
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
    }
    try {
      await ctx.finishOnboarding(patch);
      ctx.toast(message);
      navigate('dashboard');
    } catch (err) {
      console.warn('Could not finish onboarding', err);
      if (error) error.textContent = 'That did not save. Check that this browser allows local storage.';
      ctx.toast('Could not open the desk. Local storage may be blocked.', { type: 'error' });
    } finally {
      if (button) {
        button.disabled = false;
        button.removeAttribute('aria-busy');
      }
    }
  };

  signup?.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(signup);
    const entered = String(data.get('name') || '').trim();
    const enteredEmail = String(data.get('email') || '').trim();

    if (!entered) {
      if (error) error.textContent = 'A name is all Puffy needs — anything you like.';
      nameInput?.focus();
      return;
    }
    if (enteredEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(enteredEmail)) {
      if (error) error.textContent = 'That email does not look quite right.';
      root.querySelector('#signup-email')?.focus();
      return;
    }

    const first = entered.split(' ')[0];
    enter(submit, `Desk ready, ${first}. Everything stays on this device.`, {
      name: entered,
      email: enteredEmail,
    });
  });

  root.querySelector('[data-return]')?.addEventListener('click', (event) => {
    enter(event.currentTarget, `Welcome back, ${firstName}.`, {});
  });

  root.querySelector('[data-demo]')?.addEventListener('click', (event) => {
    enter(event.currentTarget, 'Demo desk open. Have a look around.', { name, email });
  });

  return {};
}
