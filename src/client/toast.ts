export type ToastType = 'success' | 'error' | 'info';

interface ToastOptions {
  message: string;
  type?: ToastType;
  duration?: number;
}

const DEFAULT_DURATION = 3000;

let container: HTMLElement | null = null;

function getContainer(): HTMLElement {
  if (container && container.isConnected) return container;
  container = document.createElement('div');
  container.className = 'toast-container';
  container.setAttribute('aria-live', 'polite');
  document.body.appendChild(container);
  return container;
}

export function showToast(options: ToastOptions): void {
  const { message, type = 'info', duration = DEFAULT_DURATION } = options;
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = message;
  el.setAttribute('role', 'status');

  const c = getContainer();
  c.appendChild(el);

  // Trigger entrance animation
  requestAnimationFrame(() => {
    el.classList.add('toast-visible');
  });

  setTimeout(() => {
    el.classList.remove('toast-visible');
    el.classList.add('toast-exit');
    el.addEventListener('transitionend', () => el.remove(), { once: true });
    // Fallback removal if transition doesn't fire
    setTimeout(() => { if (el.isConnected) el.remove(); }, 400);
  }, duration);
}

export function toast(message: string, type: ToastType = 'info'): void {
  showToast({ message, type });
}
