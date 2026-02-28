/**
 * Runtime helpers — shared low-level utilities for accessing game state.
 *
 * Provides safe data access wrappers used by tools, combat, semantics,
 * and other runtime modules.  These are intentionally decoupled from any
 * domain-specific logic.
 */

// ── Safe Data Access ────────────────────────────────────────

/**
 * Safely read a value from the game runtime.
 * Returns `fallback` on any error or if the accessor returns `undefined`/`null`.
 *
 * Also rejects function values — some game objects (e.g. the `C` computed
 * NPC cache) expose getter-like properties that are plain function references
 * rather than evaluated results.  Storing such values downstream (IndexedDB
 * structured clone, JSON serialisation) would fail, so we treat them as
 * missing and return the fallback instead.
 */
export function safeRead<T>(fn: () => T, fallback: T): T {
  try {
    const v = fn();
    if (typeof v === 'function') return fallback;
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

/** Shorthand for accessing SugarCube story variables (`State.variables`). */
export function getV(): Record<string, any> | null {
  try {
    return (window as any)?.V ?? null;
  } catch {
    return null;
  }
}

/** Shorthand for accessing the `Time` singleton. */
export function getTime(): Record<string, any> | null {
  try {
    return (window as any)?.Time ?? null;
  } catch {
    return null;
  }
}

/** Shorthand for accessing the `C` (computed conditions / NPC alias) object. */
export function getC(): Record<string, any> | null {
  try {
    return (window as any)?.C ?? null;
  } catch {
    return null;
  }
}

/** Shorthand for accessing `SugarCube.setup` (static constants). */
export function getSetup(): Record<string, any> | null {
  try {
    return (window as any)?.SugarCube?.setup ?? (window as any)?.setup ?? null;
  } catch {
    return null;
  }
}

/** Shorthand for accessing `Weather` singleton. */
export function getWeather(): Record<string, any> | null {
  try {
    return (window as any)?.Weather ?? null;
  } catch {
    return null;
  }
}

// ── NPC Helpers ───────────────────────────────────────────

/**
 * Resolve a love-alias entry for an NPC.
 *
 * `setup.loveAlias` stores arrow functions (`() => "Love"`) rather than
 * plain strings so that some entries (e.g. Gwylan) can be state-dependent.
 * We call the function here to obtain the actual localised label.
 */
export function resolveLoveAlias(setup: Record<string, any> | null, npcName: string): string {
  try {
    const raw = setup?.loveAlias?.[npcName];
    if (typeof raw === 'function') return String(raw()) || 'unknown';
    if (typeof raw === 'string') return raw || 'unknown';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}


