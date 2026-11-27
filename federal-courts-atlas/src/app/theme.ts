// Theme: follows prefers-color-scheme until the reader picks one; the choice is
// persisted in localStorage (wrapped in try/catch: storage can be blocked).
// index.html applies the stored theme before first paint to avoid a flash.

export type Theme = 'light' | 'dark';
const KEY = 'fca-theme';

export function storedTheme(): Theme | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

function systemTheme(): Theme {
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function currentTheme(): Theme {
  const attr = document.documentElement.dataset.theme;
  return attr === 'light' || attr === 'dark' ? attr : systemTheme();
}

const listeners = new Set<(t: Theme) => void>();

export function onThemeChange(fn: (t: Theme) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setTheme(t: Theme): void {
  document.documentElement.dataset.theme = t;
  try {
    localStorage.setItem(KEY, t);
  } catch {
    /* storage unavailable: the choice lasts for this page view */
  }
  for (const fn of listeners) fn(t);
}

export function toggleTheme(): Theme {
  const next: Theme = currentTheme() === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
}

export function initTheme(): void {
  const s = storedTheme();
  if (s) document.documentElement.dataset.theme = s;
  if (typeof matchMedia === 'function') {
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (!storedTheme()) for (const fn of listeners) fn(currentTheme());
    });
  }
}
