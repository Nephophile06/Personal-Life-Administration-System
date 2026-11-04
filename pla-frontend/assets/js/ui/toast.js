import { icon } from '../icons.js';

function region() {
  let el = document.querySelector('.toast-region');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast-region';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }
  return el;
}

export function toast(message, { type = 'success', duration = 3200 } = {}) {
  const host = region();
  const el = document.createElement('div');
  el.className = 'toast';
  const glyph = type === 'error' ? 'alert' : type === 'info' ? 'info' : 'check-circle';
  el.innerHTML = `${icon(glyph, 18)}<span>${message}</span>`;
  host.appendChild(el);

  const remove = () => {
    el.classList.add('is-leaving');
    setTimeout(() => el.remove(), 240);
  };
  const timer = setTimeout(remove, duration);
  el.addEventListener('click', () => {
    clearTimeout(timer);
    remove();
  });
}

export const toastError = (msg) => toast(msg, { type: 'error', duration: 4200 });
