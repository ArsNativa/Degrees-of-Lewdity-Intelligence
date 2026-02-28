/**
 * Clothing semantic mappings — value → label for integrity and exposure.
 *
 * Thresholds verified against:
 * - DOL/game/03-JavaScript/base.js `clothesIntegrity()` — 4 tiers based on ratio
 * - Exposure values from combat system: 0=covered, 1=partial, 2=fully exposed
 *
 * Pure functions — no side effects, no external dependencies.
 */

// ── Clothing Integrity ───────────────────────────────────────
// Source: base.js `clothesIntegrity()` — ratio-based 4 tiers

/**
 * Map clothing integrity to a durability label.
 *
 * Uses ratio = integrity / max:
 * ≤0.2 → tattered, ≤0.5 → torn, ≤0.9 → frayed, >0.9 → full.
 */
export function integrityLabel(integrity: number | undefined, max: number | undefined): string {
  if (integrity == null || max == null || max <= 0) return 'unknown';
  const ratio = integrity / max;
  if (ratio <= 0.2) return 'tattered';
  if (ratio <= 0.5) return 'torn';
  if (ratio <= 0.9) return 'frayed';
  return 'full';
}

// ── Clothing Exposure ────────────────────────────────────────
// Source: combat system clothing snapshot — integer 0/1/2

/**
 * Map clothing exposure value to a label.
 *
 * 0→covered, 1→partially exposed, 2→fully exposed.
 */
export function exposureLabel(value: number): string {
  if (value >= 2) return 'fully exposed';
  if (value >= 1) return 'partially exposed';
  return 'covered';
}
