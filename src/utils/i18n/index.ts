/**
 * Lightweight i18n module built on rosetta.
 *
 * Usage:
 *   import { t } from '../../utils/i18n/index.js';
 *   t('ui.title')           // → "智能助手"
 *   t('error.http', { code: 401 }) // → interpolation
 *
 * Language detection priority:
 *   1. Explicit call to setLocale()
 *   2. Browser language (navigator.language)
 *   3. Default: zh-CN
 */
import rosetta from 'rosetta';
import zhCN from './zh-CN.js';
import en from './en.js';

const i18n = rosetta({
  'zh-CN': zhCN,
  'en': en,
});

/** Resolve the best locale from browser settings. */
function detectLocale(): string {
  try {
    const lang = navigator.language || '';
    if (lang.startsWith('zh')) return 'zh-CN';
    if (lang.startsWith('en')) return 'en';
    // Fallback: check all preferred languages
    const langs = navigator.languages ?? [];
    for (const l of langs) {
      if (l.startsWith('zh')) return 'zh-CN';
      if (l.startsWith('en')) return 'en';
    }
  } catch {
    // ignore
  }
  return 'zh-CN';
}

// Auto-detect on load
i18n.locale(detectLocale());

/** Translate a key with optional interpolation params. */
export function t(key: string, params?: Record<string, string | number>): string {
  const result = i18n.t(key, params) as unknown;
  // rosetta returns '' for missing keys; fall back to key itself
  return (typeof result === 'string' && result) ? result : key;
}

/** Switch locale at runtime. */
export function setLocale(locale: string): void {
  // Normalise: "zh" → "zh-CN"
  const resolved = locale.startsWith('zh') ? 'zh-CN' : locale.startsWith('en') ? 'en' : locale;
  i18n.locale(resolved);
}

/** Get the current locale string. */
export function getLocale(): string {
  return (i18n as any)._locale ?? 'zh-CN';
}
