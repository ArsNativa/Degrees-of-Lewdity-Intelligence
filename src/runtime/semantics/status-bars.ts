/**
 * Status bar semantic mappings — value → label for core status bars.
 *
 * Maps game numeric status values to game-accurate 7-tier labels.
 * All thresholds are verified against the sidebar caption widgets in
 * DOL/game/base-system/widgets.twee.
 *
 * Pure functions — no side effects, no external dependencies.
 */

import { fmtNum } from '../../utils/format.js';

export interface StatusLevelFormatOptions {
  /** Include max value in output text, e.g. `lustful (3500/10000)`. */
  includeMax?: boolean;
}

function formatStatusLevel(
  label: string,
  value: number,
  max: number | undefined,
  options?: StatusLevelFormatOptions,
): string {
  if (options?.includeMax && typeof max === 'number' && max > 0) {
    return `${label} (${fmtNum(value)}/${fmtNum(max)})`;
  }
  return `${label} (${fmtNum(value)})`;
}

// ── Trauma ──────────────────────────────────────────────────
// Source: widgets.twee «traumacaption» — max/5 intervals, default traumamax=5000

/**
 * Map trauma value to game-accurate 7-tier label.
 *
 * Thresholds: 0→healthy, 1→uneasy, max/5→nervous, max*2/5→troubled,
 * max*3/5→disturbed, max*4/5→tormented, max→numb.
 */
export function traumaLevel(value: number, max: number, options?: StatusLevelFormatOptions): string {
  if (max <= 0) return `unknown (${value})`;
  let label: string;
  if (value >= max)           label = 'numb';
  else if (value >= max * 4 / 5) label = 'tormented';
  else if (value >= max * 3 / 5) label = 'disturbed';
  else if (value >= max * 2 / 5) label = 'troubled';
  else if (value >= max / 5)     label = 'nervous';
  else if (value >= 1)           label = 'uneasy';
  else                           label = 'healthy';
  return formatStatusLevel(label, value, max, options);
}

// ── Stress ──────────────────────────────────────────────────
// Source: widgets.twee «stresscaption» — max/5 intervals, default stressmax=10000

/**
 * Map stress value to game-accurate 7-tier label.
 *
 * Thresholds: 0→serene, 1→placid, max/5→calm, max*2/5→tense,
 * max*3/5→strained, max*4/5→distressed, max→overwhelmed.
 */
export function stressLevel(value: number, max: number, options?: StatusLevelFormatOptions): string {
  if (max <= 0) return `unknown (${value})`;
  let label: string;
  if (value >= max)           label = 'overwhelmed';
  else if (value >= max * 4 / 5) label = 'distressed';
  else if (value >= max * 3 / 5) label = 'strained';
  else if (value >= max * 2 / 5) label = 'tense';
  else if (value >= max / 5)     label = 'calm';
  else if (value >= 1)           label = 'placid';
  else                           label = 'serene';
  return formatStatusLevel(label, value, max, options);
}

// ── Arousal ─────────────────────────────────────────────────
// Source: widgets.twee «arousalcaption» — max/5 intervals, default arousalmax=10000

/**
 * Map arousal value to game-accurate 7-tier label.
 *
 * Thresholds: 0→cold, 1→stimulated, max/5→aroused, max*2/5→lustful,
 * max*3/5→horny, max*4/5→heat rising, max→shaking with arousal.
 */
export function arousalLevel(value: number, max: number, options?: StatusLevelFormatOptions): string {
  if (max <= 0) return `unknown (${value})`;
  let label: string;
  if (value >= max)           label = 'shaking with arousal';
  else if (value >= max * 4 / 5) label = 'heat rising';
  else if (value >= max * 3 / 5) label = 'horny';
  else if (value >= max * 2 / 5) label = 'lustful';
  else if (value >= max / 5)     label = 'aroused';
  else if (value >= 1)           label = 'stimulated';
  else                           label = 'cold';
  return formatStatusLevel(label, value, max, options);
}

// ── Control ─────────────────────────────────────────────────
// Source: widgets.twee «controlcaption» — max/5 intervals, two modes (possessed/normal)
// Note: Control is an inverted bar (high = good).

/**
 * Map control value to game-accurate 7-tier label.
 *
 * Has two distinct label sets depending on `possessed` state.
 * Normal: confident → insecure → worried → anxious → scared → frightened → terrified.
 * Possessed: in control → nearly in control → struggling → hollow → numb → puppeteered → helpless.
 */
export function controlLevel(
  value: number,
  max: number,
  possessed = false,
  options?: StatusLevelFormatOptions,
): string {
  if (max <= 0) return `unknown (${value})`;

  if (possessed) {
    let label: string;
    if (value >= max)           label = 'in control';
    else if (value >= max * 4 / 5) label = 'nearly in control';
    else if (value >= max * 3 / 5) label = 'struggling';
    else if (value >= max * 2 / 5) label = 'hollow';
    else if (value >= max / 5)     label = 'numb';
    else if (value >= 1)           label = 'puppeteered';
    else                           label = 'helpless';
    return formatStatusLevel(label, value, max, options);
  }

  let label: string;
  if (value >= max)           label = 'confident';
  else if (value >= max * 4 / 5) label = 'insecure';
  else if (value >= max * 3 / 5) label = 'worried';
  else if (value >= max * 2 / 5) label = 'anxious';
  else if (value >= max / 5)     label = 'scared';
  else if (value >= 1)           label = 'frightened';
  else                           label = 'terrified';
  return formatStatusLevel(label, value, max, options);
}

// ── Generic status (max/5 intervals) ────────────────────────

/**
 * Map a generic status value by max/5 intervals.
 * Returns generic 7-tier labels.  Use dedicated functions (traumaLevel,
 * stressLevel, etc.) when the stat has game-specific labels.
 */
export function statusLevel(value: number, max: number, options?: StatusLevelFormatOptions): string {
  if (max <= 0) return `unknown (${value})`;
  let label: string;
  if (value >= max)           label = 'maxed';
  else if (value >= max * 4 / 5) label = 'very high';
  else if (value >= max * 3 / 5) label = 'high';
  else if (value >= max * 2 / 5) label = 'moderate';
  else if (value >= max / 5)     label = 'low';
  else if (value >= 1)           label = 'very low';
  else                           label = 'none';
  return formatStatusLevel(label, value, max, options);
}

// ── Tiredness / Fatigue ─────────────────────────────────────
// Source: widgets.twee «tirednesscaption» — max/5 intervals, C.tiredness.max=2000

/**
 * Map fatigue/tiredness value to game-accurate 7-tier label.
 *
 * Thresholds: 0→refreshed, 1→wide awake, max/5→alert, max*2/5→wearied,
 * max*3/5→tired, max*4/5→fatigued, max→exhausted.
 * Default max = 2000.
 */
export function fatigueLevel(value: number, max = 2000, options?: StatusLevelFormatOptions): string {
  let label: string;
  if (value >= max)           label = 'exhausted';
  else if (value >= max * 4 / 5) label = 'fatigued';
  else if (value >= max * 3 / 5) label = 'tired';
  else if (value >= max * 2 / 5) label = 'wearied';
  else if (value >= max / 5)     label = 'alert';
  else if (value >= 1)           label = 'wide awake';
  else                           label = 'refreshed';
  return formatStatusLevel(label, value, max, options);
}

// ── Hunger ──────────────────────────────────────────────────
// Source: widgets.twee «hunger_description» — fixed thresholds

/**
 * Map hunger value to game-accurate 7-tier label.
 *
 * Thresholds: 0→full, 1→satiated, 400→peckish, 800→hungry,
 * 1200→ravenous, 1600→famished, 2000→starving.
 */
export function hungerLevel(value: number): string {
  let label: string;
  if (value >= 2000) label = 'starving';
  else if (value >= 1600) label = 'famished';
  else if (value >= 1200) label = 'ravenous';
  else if (value >= 800)  label = 'hungry';
  else if (value >= 400)  label = 'peckish';
  else if (value >= 1)    label = 'satiated';
  else                    label = 'full';
  return `${label} (${fmtNum(value)})`;
}

// ── Pain ────────────────────────────────────────────────────
// Source: widgets.twee «paincaption» — fixed thresholds (0–100)

/**
 * Map pain value to game-accurate 7-tier label.
 *
 * Thresholds: 0→okay, 1→upset, 20→tears welling, 40→tears running,
 * 60→crying, 80→crying and whimpering, 100→sobbing uncontrollably.
 */
export function painLevel(value: number): string {
  let label: string;
  if (value >= 100) label = 'sobbing uncontrollably';
  else if (value >= 80) label = 'crying and whimpering';
  else if (value >= 60) label = 'crying';
  else if (value >= 40) label = 'tears running';
  else if (value >= 20) label = 'tears welling';
  else if (value >= 1)  label = 'upset';
  else                  label = 'okay';
  return `${label} (${fmtNum(value)})`;
}
