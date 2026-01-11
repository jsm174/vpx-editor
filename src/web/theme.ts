import { getEvents } from './state';

export function getSystemTheme(): 'dark' | 'light' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function resolveTheme(theme: string | undefined): 'dark' | 'light' {
  if (theme === 'system' || !theme) {
    return getSystemTheme();
  }
  return theme as 'dark' | 'light';
}

export function applyTheme(theme: string | undefined): void {
  const events = getEvents();
  const resolved = resolveTheme(theme);
  document.documentElement.setAttribute('data-theme', resolved);
  events.emit('set-theme', resolved);
}
