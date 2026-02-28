/**
 * Relationship semantic mappings — value → label for NPC relationships
 * and player submissiveness.
 *
 * Note: The game displays NPC relationships as bar meters without text
 * labels. These mappings are mod-defined approximations used to give
 * the AI agent a qualitative sense of relationship strength.
 *
 * Pure functions — no side effects, no external dependencies.
 */
import { fmtNum } from '../../utils/format.js';

// ── Relationship Level ───────────────────────────────────────
// MOD-DEFINED: Game has no official text labels for relationship bars.

/**
 * Map an unbounded relationship value to a human-readable level.
 *
 * Mod-defined thresholds (game uses bar meters, no text labels):
 * <-30 → very low, -30–0 → low, 0–30 → moderate, 30–60 → high, ≥60 → very high.
 *
 * Note: max values vary per NPC (e.g. Whitney love max=30, Eden love max=200).
 */
export function relationLevel(value: number): string {
  let label: string;
  if (value >= 60) label = 'very high';
  else if (value >= 30) label = 'high';
  else if (value >= 0) label = 'moderate';
  else if (value >= -30) label = 'low';
  else label = 'very low';
  return `${label} (${fmtNum(value)})`;
}

// ── Submissive Level ─────────────────────────────────────────
// MOD-DEFINED: Game has no official text labels for submissiveness.

/**
 * Map submissiveness value to a descriptive label.
 *
 * Mod-defined thresholds. Game default is 1000 (middle ground).
 * Lower = more defiant, Higher = more submissive.
 * Range is approximately 0–2000.
 */
export function submissiveLevel(value: number): string {
  let label: string;
  if (value >= 1800) label = 'completely submissive';
  else if (value >= 1400) label = 'very submissive';
  else if (value >= 1100) label = 'submissive';
  else if (value >= 900) label = 'balanced';
  else if (value >= 600) label = 'defiant';
  else if (value >= 200) label = 'very defiant';
  else label = 'completely defiant';
  return `${label} (${fmtNum(value)})`;
}
