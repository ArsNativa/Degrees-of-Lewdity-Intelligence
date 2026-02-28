/**
 * Social semantic mappings — value → label for fame, police, school reputation.
 *
 * Thresholds verified against:
 * - DOL/game/base-system/overlays/social.twee
 *   `_fameStates` (L78–L84), `_policeCrimeConfig` (L144–L152),
 *   `_teacherRepConfig` (L207–L215), `_studentRepConfig` (L216–L224),
 *   orphanage mood matrix (L167–L202)
 *
 * Pure functions — no side effects, no external dependencies.
 */
import { fmtNum } from '../../utils/format.js';

// ── Fame ─────────────────────────────────────────────────────
// Source: social.twee `_fameStates` — 7 thresholds

/**
 * Map a per-category fame value (0–1000) to a descriptive level.
 *
 * Thresholds: 0→Unknown, 30→Obscure, 100→Low-key, 200→Known,
 * 400→Recognised, 600→Famous, 1000→Notorious.
 */
export function fameLevel(value: number): string {
  let label: string;
  if (value >= 1000) label = 'Notorious';
  else if (value >= 600) label = 'Famous';
  else if (value >= 400) label = 'Recognised';
  else if (value >= 200) label = 'Known';
  else if (value >= 100) label = 'Low-key';
  else if (value >= 30) label = 'Obscure';
  else label = 'Unknown';
  return `${label} (${fmtNum(value)})`;
}

// ── Police Status ────────────────────────────────────────────
// Source: social.twee `_policeCrimeConfig` (L144–L152) — 7 thresholds
// FIXED: previous implementation had wrong thresholds (100/500/1500/3000/5000/8000)

/**
 * Map total crime history to game-accurate police awareness label.
 *
 * Thresholds: 0→aren't concerned, 1000→on their records,
 * 2000→person of interest, 3000→troublemaker, 5000→criminal,
 * 10000→binder devoted to you, 30000→filing cabinet devoted to you.
 */
export function policeStatusLabel(totalHistory: number): string {
  let label: string;
  if (totalHistory >= 30000) label = 'filing cabinet devoted to you';
  else if (totalHistory >= 10000) label = 'binder devoted to you';
  else if (totalHistory >= 5000) label = 'criminal';
  else if (totalHistory >= 3000) label = 'troublemaker';
  else if (totalHistory >= 2000) label = 'person of interest';
  else if (totalHistory >= 1000) label = 'on their records';
  else label = "aren't concerned";
  return `${label} (${fmtNum(totalHistory)})`;
}

// ── Delinquency ──────────────────────────────────────────────
// Source: social.twee `_teacherRepConfig` (L207–L215) — 7 thresholds
// FIXED: previous implementation had wrong thresholds (50/100/200/400/600/800)

/**
 * Map delinquency value to game-accurate school reputation label.
 *
 * Thresholds: 0→ideal student, 10→normal student, 200→bad student,
 * 400→delinquent, 600→delinquent, 800→delinquent, 1000→terror.
 */
export function delinquencyLabel(value: number): string {
  let label: string;
  if (value >= 1000) label = 'terror';
  else if (value >= 400) label = 'delinquent';
  else if (value >= 200) label = 'bad student';
  else if (value >= 10) label = 'normal student';
  else label = 'ideal student';
  return `${label} (${fmtNum(value)})`;
}

// ── Coolness ─────────────────────────────────────────────────
// Source: social.twee `_studentRepConfig` (L216–L224) — 7 thresholds
// FIXED: previous implementation had wrong thresholds and labels

/**
 * Map coolness value to game-accurate student reputation label.
 *
 * Thresholds: 0→avoid you, 40→odd, 80→dorky, 120→ok,
 * 160→cool, 240→very cool, 400→aspire to be seen with you.
 */
export function coolLabel(value: number): string {
  let label: string;
  if (value >= 400) label = 'aspire to be seen with you';
  else if (value >= 240) label = 'very cool';
  else if (value >= 160) label = 'cool';
  else if (value >= 120) label = 'ok';
  else if (value >= 80) label = 'dorky';
  else if (value >= 40) label = 'odd';
  else label = 'avoid you';
  return `${label} (${fmtNum(value)})`;
}

// ── Orphanage Mood ───────────────────────────────────────────
// Source: social.twee L167–202 — 5×5 hope×rebellion matrix

/**
 * Compute orphanage atmosphere mood from hope × rebellion.
 *
 * Returns one of 25 mood labels from the game's 5×5 matrix.
 */
export function orphanageMood(hope: number, reb: number): string {
  const hopeIdx = hope < -40 ? 0 : hope < -10 ? 1 : hope <= 10 ? 2 : hope <= 40 ? 3 : 4;
  const rebIdx  = reb  < -40 ? 0 : reb  < -10 ? 1 : reb  <= 10 ? 2 : reb  <= 40 ? 3 : 4;
  const matrix: string[][] = [
    ['hopeless',  'crestfallen', 'unhappy',    'spiteful',    'vengeful'],
    ['morose',    'dispirited',  'resigned',   'disobedient', 'unruly'],
    ['obedient',  'compliant',   'calm',       'subversive',  'defiant'],
    ['enduring',  'unresistant', 'optimistic', 'rebellious',  'mutinous'],
    ['kind',      'friendly',    'hopeful',    'idealistic',  'revolutionary'],
  ];
  return matrix[hopeIdx][rebIdx];
}
