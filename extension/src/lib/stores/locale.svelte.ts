import { locale } from 'svelte-i18n';
import { get } from 'svelte/store';
import { getSystemLocale, hasStoredLocale, clearStoredLocale } from '$lib/i18n';

const STORAGE_KEY = 'ghost-auth-ext-locale';

const RTL_LOCALES = new Set(['ar', 'he', 'fa', 'fa-AE', 'fa-AF', 'fa-IR', 'ur']);

let current: string = $state(get(locale) ?? 'en');
let isSystemDefault: boolean = $state(!hasStoredLocale());

locale.subscribe((val) => {
  current = val ?? 'en';
  if (typeof document !== 'undefined') {
    document.documentElement.lang = current;
    document.documentElement.dir = RTL_LOCALES.has(current) ? 'rtl' : 'ltr';
  }
});

export function getLocale(): string {
  return current;
}

export function getIsSystemDefault(): boolean {
  return isSystemDefault;
}

export function setLocale(code: string) {
  locale.set(code);
  localStorage.setItem(STORAGE_KEY, code);
  isSystemDefault = false;
}

export function setSystemDefault() {
  clearStoredLocale();
  locale.set(getSystemLocale());
  isSystemDefault = true;
}
