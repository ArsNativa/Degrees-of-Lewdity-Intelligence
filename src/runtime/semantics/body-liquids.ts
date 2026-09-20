/**
 * Body liquids semantic labels and amount descriptors.
 *
 * Maps game body-liquid data (parts, liquids, amounts) to English semantic labels.
 * These labels are extracted directly from game source, enabling accurate
 * tracing back to original game mechanics.
 *
 * All labels are in English; translation is handled by the LLM layer.
 */

// ── Liquid Types ────────────────────────────────────────

/** All liquid types tracked in $player.bodyliquid */
export const LIQUID_TYPES = ['semen', 'goo', 'nectar'] as const;
export type LiquidType = typeof LIQUID_TYPES[number];

/** English name for each liquid type (maps to game source terminology) */
export const LIQUID_NAMES: Record<LiquidType, string> = {
  semen: 'semen',
  goo: 'goo',
  nectar: 'nectar',
};

// ── Body Parts ──────────────────────────────────────────

/** All body parts that can hold liquids ($player.bodyliquid keys) */
export const BODY_LIQUID_PARTS = [
  'neck',
  'rightarm',
  'leftarm',
  'thigh',
  'bottom',
  'tummy',
  'chest',
  'face',
  'hair',
  'feet',
  'vaginaoutside',
  'vagina',
  'penis',
  'anus',
  'mouth',
] as const;
export type BodyLiquidPart = typeof BODY_LIQUID_PARTS[number];

/** English names for body parts (source-accurate, from game mechanics) */
export const BODY_PART_NAMES: Record<BodyLiquidPart, string> = {
  neck: 'neck',
  rightarm: 'right arm',
  leftarm: 'left arm',
  thigh: 'thigh',
  bottom: 'bottom',
  tummy: 'tummy',
  chest: 'chest',
  face: 'face',
  hair: 'hair',
  feet: 'feet',
  vaginaoutside: 'vagina outside',
  vagina: 'vagina',
  penis: 'penis',
  anus: 'anus',
  mouth: 'mouth',
};

// ── Amount Levels ───────────────────────────────────────

/**
 * Describe liquid amount as a level descriptor (trace → abundant).
 * Amount is typically 0–5 in game (see DOL/game/base-system/).
 */
export function liquidAmountLevel(amount: number): string {
  if (amount <= 0) return '';
  if (amount <= 1) return 'trace';
  if (amount <= 2) return 'small amount';
  if (amount <= 3) return 'moderate amount';
  if (amount <= 4) return 'large amount';
  return 'abundant';
}

// ── Special Part Descriptions ───────────────────────

/**
 * Generate a semantic description for liquid on vagina.
 * Returns [prefix, suffix] tuple that can be combined with liquid name.
 *
 * Example: "sticky semen dripping from your pussy"
 */
export function liquidVaginaDesc(amount: number): [prefix: string, suffix: string] {
  if (amount <= 0) return ['', ''];
  if (amount <= 1) return ['', ' dripping from your pussy'];
  if (amount <= 2) return ['', ' forming a strand between your pussy and the ground'];
  if (amount <= 3) return ['', ' running down your thighs from your pussy'];
  if (amount <= 4) return ['overflowing ', ' pouring from your pussy'];
  return ['overflowing ', ' dripping from your womb'];
}

/**
 * Generate a semantic description for liquid on bottom/anus.
 * Returns [prefix, suffix] tuple that can be combined with liquid name.
 */
export function liquidBottomDesc(amount: number): [prefix: string, suffix: string] {
  if (amount <= 0) return ['', ''];
  if (amount <= 1) return ['', ' dripping from your ass'];
  if (amount <= 2) return ['', ' forming a strand between your ass and the ground'];
  if (amount <= 3) return ['', ' running down from your bottom'];
  if (amount <= 4) return ['', ' seeping from your ass'];
  return ['your bowels full of ', ''];
}

/**
 * Generate a semantic description for liquid on mouth/oral.
 * Returns [prefix, suffix] tuple that can be combined with liquid name.
 */
export function liquidOralDesc(amount: number): [prefix: string, suffix: string] {
  if (amount <= 0) return ['', ''];
  if (amount <= 1) return ['lingering taste of ', ' on your tongue'];
  if (amount <= 2) return ['', ' leaking from your throat'];
  if (amount <= 3) return ['', ' running down your chin from your mouth'];
  if (amount <= 4) return ['overflowing ', ' dripping from your lips'];
  return ['constantly coughing up ', ''];
}

/**
 * Get semantic description for a liquid on a specific body part.
 * 
 * For special parts (vagina, anus, mouth), returns contextual description.
 * For other parts, returns empty (basic "amount + part" can be composed instead).
 */
export function liquidPartialDesc(
  part: BodyLiquidPart,
  amount: number,
): [prefix: string, suffix: string] {
  switch (part) {
    case 'vagina':
      return liquidVaginaDesc(amount);
    case 'anus':
    case 'bottom':
      return liquidBottomDesc(amount);
    case 'mouth':
      return liquidOralDesc(amount);
    default:
      return ['', ''];
  }
}
