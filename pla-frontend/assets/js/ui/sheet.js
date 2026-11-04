import { icon } from '../icons.js';

/**
 * A native <dialog> presented as a bottom sheet on phones and centred modal
 * on desktop. Returns handles so the caller can close it or update its body.
 */
export function openSheet({
  title = '',
  subtitle = '',
  body = '',
  footer = '',
  eyebrow = '',
  size = '',
  initialFocus = '',
  onClose,
} = {}) {
  const dialog = document.createElement('dialog');
  dialog.className = `sheet ${size}`;
  dialog.setAttribute('aria-labelledby', 'sheet-title');
  dialog.innerHTML = `
    <div class="sheet__grab" aria-hidden="true"></div>
    <header class="sheet__head">
      <div class="grow">
        ${eyebrow ? `<span class="eyebrow eyebrow--plain">${eyebrow}</span>` : ''}
        <h2 id="sheet-title">${title}</h2>
        ${subtitle ? `<p>${subtitle}</p>` : ''}
      </div>
      <button class="icon-btn" type="button" data-close aria-label="Close">${icon('close', 18)}</button>
    </header>
    <div class="sheet__body">${body}</div>
    ${footer ? `<footer class="sheet__foot">${footer}</footer>` : ''}
  `;

  document.body.appendChild(dialog);
  dialog.showModal();

  const close = () => {
    if (dialog.open) dialog.close();
  };

  dialog.addEventListener('click', (e) => {
    if (e.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    const outside =
      e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    if (outside) close();
  });

  dialog.querySelectorAll('[data-close]').forEach((btn) => btn.addEventListener('click', close));

  dialog.addEventListener('close', () => {
    onClose?.();
    dialog.remove();
  });

  requestAnimationFrame(() => {
    const target = initialFocus
      ? dialog.querySelector(initialFocus)
      : dialog.querySelector('input:not([type="hidden"]), textarea, select');
    if (target && !window.matchMedia('(pointer: coarse)').matches) target.focus();
  });

  return {
    dialog,
    close,
    body: dialog.querySelector('.sheet__body'),
    footer: dialog.querySelector('.sheet__foot'),
  };
}

/** Simple confirm sheet that resolves true/false. */
export function confirmSheet({
  title = 'Are you sure?',
  message = '',
  confirmLabel = 'Confirm',
  tone = 'danger',
} = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const sheet = openSheet({
      title,
      body: `<p class="lede" style="font-size:var(--text-base)">${message}</p>`,
      footer: `
        <button class="btn btn--ghost" type="button" data-cancel>Keep it</button>
        <button class="btn ${tone === 'danger' ? 'btn--danger' : 'btn--primary'}" type="button" data-ok>${confirmLabel}</button>
      `,
      onClose: () => {
        if (!settled) resolve(false);
      },
    });
    sheet.footer.querySelector('[data-cancel]').addEventListener('click', () => {
      settled = true;
      sheet.close();
      resolve(false);
    });
    sheet.footer.querySelector('[data-ok]').addEventListener('click', () => {
      settled = true;
      sheet.close();
      resolve(true);
    });
  });
}
