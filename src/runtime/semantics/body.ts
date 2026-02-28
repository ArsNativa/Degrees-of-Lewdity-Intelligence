/**
 * Body semantic mappings — value → label for body sizes and gender.
 *
 * Thresholds verified against:
 * - DOL/game/base-system/variables-static.twee `setup.breastsizes` / `setup.penisSizes`
 * - DOL/game/base-system/text.twee (bottom sizes inline array)
 *
 * `breastSizeDesc` and `penisSizeDesc` prioritize reading from the live
 * `setup` object so that localized mods (e.g. i18n) are respected.
 * They fall back to English labels when the game constants are unavailable.
 *
 * Pure functions — no side effects (reads setup at call-time only).
 */
import { getSetup } from '../access.js';
import { fmtNum } from '../../utils/format.js';

// ── Breast Size ──────────────────────────────────────────────

/**
 * Breast size number (0–12) → descriptive string.
 *
 * Prioritizes reading from `setup.breastsizes` (follows game localization).
 * Falls back to English labels if game constants unavailable.
 * Returns "label (size)".
 */
export function breastSizeDesc(size: number): string {
  const setup = getSetup();
  const gameLabels: string[] | undefined = setup?.breastsizes;
  if (gameLabels && Array.isArray(gameLabels) && gameLabels.length > 0) {
    const idx = Math.max(0, Math.min(size, gameLabels.length - 1));
    const label = gameLabels[idx];
    return `${label || 'flat'} (${fmtNum(size)})`;
  }
  const fallback = [
    'flat', 'budding', 'tiny', 'small', 'pert',
    'modest', 'full', 'large', 'ample', 'massive',
    'huge', 'gigantic', 'enormous',
  ];
  const label = fallback[Math.max(0, Math.min(size, fallback.length - 1))] ?? 'unknown';
  return `${label} (${fmtNum(size)})`;
}

// ── Penis Size ───────────────────────────────────────────────

/**
 * Penis size number (-2–4) → descriptive string.
 *
 * Prioritizes reading from `setup.penisSizes` (follows game localization).
 * Note: Game uses `penissize + 2` to index into penisSizes array.
 * Falls back to English labels if game constants unavailable.
 * Returns "label (size)".
 */
export function penisSizeDesc(size: number): string {
  const setup = getSetup();
  const gameLabels: string[] | undefined = setup?.penisSizes;
  if (gameLabels && Array.isArray(gameLabels) && gameLabels.length > 0) {
    const idx = Math.max(0, Math.min(size + 2, gameLabels.length - 1));
    const label = gameLabels[idx] || 'unknown';
    return `${label} (${fmtNum(size)})`;
  }
  const fallback = ['micro', 'mini', 'tiny', 'small', 'normal', 'large', 'enormous'];
  const idx = Math.max(0, Math.min(size + 2, fallback.length - 1));
  const label = fallback[idx] ?? 'unknown';
  return `${label} (${fmtNum(size)})`;
}

// ── Bottom Size ──────────────────────────────────────────────

/**
 * Bottom size number (0–8) → descriptive string.
 *
 * Labels: ["slender", "slim", "modest", "cushioned", "soft", "round", "plump", "large", "huge"]
 * Returns "label (size)".
 */
export function bottomSizeDesc(size: number): string {
  const labels = ['slender', 'slim', 'modest', 'cushioned', 'soft', 'round', 'plump', 'large', 'huge'];
  const label = labels[Math.max(0, Math.min(size, labels.length - 1))] ?? 'unknown';
  return `${label} (${fmtNum(size)})`;
}

// ── Gender ───────────────────────────────────────────────────

/**
 * Map player gender code to readable string.
 *
 * m→male, f→female, h→hermaphrodite.
 */
export function genderLabel(g: string): string {
  switch (g) {
    case 'm': return 'male';
    case 'f': return 'female';
    case 'h': return 'hermaphrodite';
    default:  return g || 'unknown';
  }
}
