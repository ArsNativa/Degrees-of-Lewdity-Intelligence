/**
 * Enemy / NPC combat semantic mappings — value → label for combat stats.
 *
 * Thresholds verified against:
 * - DOL/game/base-combat/state.twee `<<stateman>>` widget (L2–L133)
 *   enemyHealth (L34–L50), enemyArousal (L53–L78),
 *   enemyAnger (L81–L94), enemyTrust (L97–L110)
 * - DOL/game/base-combat/init.twee (default max values)
 *
 * Note: The game renders these as full sentences with NPC pronouns
 * (e.g. "He looks pained."). We extract the **adjective core** and
 * pair it with the raw value. This keeps the output concise and
 * pronoun-agnostic for LLM consumption.
 *
 * Pure functions — no side effects, no external dependencies.
 */
import { fmtNum } from '../../utils/format.js';

// ── Enemy Health ─────────────────────────────────────────────
// Source: state.twee L34–L50 — max/5 intervals, default max = ~200 per NPC
// Note: game has a special "loveDrunk" branch we ignore here (covered by arousal).

/**
 * Map enemy health to game-accurate 7-tier label.
 *
 * Health is a **damage-taken** bar (high = healthy, 0 = defeated).
 * Thresholds: ≤0 → recoiling in pain, >0 → can't take much more,
 * max/5 → hurt, max*2/5 → pained, max*3/5 → stung,
 * max*4/5 → uncomfortable, max → eager.
 */
export function enemyHealthLevel(value: number, max: number): string {
  if (max <= 0) return `unknown (${value})`;
  let label: string;
  if (value <= 0)              label = 'recoiling in pain';
  else if (value < max / 5)    label = "can't take much more";
  else if (value < max * 2 / 5) label = 'hurt';
  else if (value < max * 3 / 5) label = 'pained';
  else if (value < max * 4 / 5) label = 'stung';
  else if (value < max)         label = 'uncomfortable';
  else                          label = 'eager';
  return `${label} (${fmtNum(value)}/${fmtNum(max)})`;
}

// ── Enemy Arousal ────────────────────────────────────────────
// Source: state.twee L53–L78 — max/5 intervals, default max = 500 * enemyCount

/**
 * Map enemy arousal to game-accurate 7-tier label.
 *
 * Thresholds: ≤0 → unaroused, >0 → stimulated,
 * max/5 → aroused, max*2/5 → horny, max*3/5 → lustful,
 * max*4/5 → approaching orgasm, max → orgasm imminent.
 */
export function enemyArousalLevel(value: number, max: number): string {
  if (max <= 0) return `unknown (${value})`;
  let label: string;
  if (value >= max)              label = 'orgasm imminent';
  else if (value >= max * 4 / 5) label = 'approaching orgasm';
  else if (value >= max * 3 / 5) label = 'lustful';
  else if (value >= max * 2 / 5) label = 'horny';
  else if (value >= max / 5)     label = 'aroused';
  else if (value > 0)            label = 'stimulated';
  else                           label = 'unaroused';
  return `${label} (${fmtNum(value)}/${fmtNum(max)})`;
}

// ── Enemy Anger ──────────────────────────────────────────────
// Source: state.twee L81–L94 — max/5 intervals, default max = 200

/**
 * Map enemy anger to game-accurate 7-tier label.
 *
 * Thresholds: ≤0 → calm, >0 → tense, max/5 → irritated,
 * max*2/5 → frustrated, max*3/5 → angry, max*4/5 → furious,
 * max → incredibly pissed off.
 */
export function enemyAngerLevel(value: number, max: number): string {
  if (max <= 0) return `unknown (${value})`;
  let label: string;
  if (value >= max)              label = 'incredibly pissed off';
  else if (value >= max * 4 / 5) label = 'furious';
  else if (value >= max * 3 / 5) label = 'angry';
  else if (value >= max * 2 / 5) label = 'frustrated';
  else if (value >= max / 5)     label = 'irritated';
  else if (value > 0)            label = 'tense';
  else                           label = 'calm';
  return `${label} (${fmtNum(value)}/${fmtNum(max)})`;
}

// ── Enemy Trust ──────────────────────────────────────────────
// Source: state.twee L97–L110 — absolute thresholds (not ratio-based)
// Trust starts at 0, can go negative (suspicious) or positive (relaxed)

/**
 * Map enemy trust to game-accurate 7-tier label.
 *
 * Uses **absolute thresholds** (not ratio-based):
 * ≤-100 → full of suspicion, ≤-60 → guarded, ≤-20 → wary,
 * ≤20 → cautious, ≤60 → alert, ≤100 → relaxed, >100 → confident.
 */
export function enemyTrustLevel(value: number): string {
  let label: string;
  if (value > 100)       label = 'confident';
  else if (value > 60)   label = 'relaxed';
  else if (value > 20)   label = 'alert';
  else if (value > -20)  label = 'cautious';
  else if (value > -60)  label = 'wary';
  else if (value > -100) label = 'guarded';
  else                   label = 'full of suspicion';
  return `${label} (${fmtNum(value)})`;
}

// ── NPC Penis Size (combat) ──────────────────────────────────
// Source: npc-generation.twee L886–L912

/**
 * Map NPC penis size (0–5) to descriptive label.
 *
 * 0 → none, 1 → tiny, 2 → average, 3 → large, 4 → massive, 5 → enormous.
 * Note: size 5 is beast-only (horses).
 */
export function npcPenisSizeDesc(size: number): string {
  const labels = ['none', 'tiny', 'average', 'large', 'massive', 'enormous'];
  const label = labels[Math.max(0, Math.min(size, labels.length - 1))] ?? 'unknown';
  return `${label} (${fmtNum(size)})`;
}
