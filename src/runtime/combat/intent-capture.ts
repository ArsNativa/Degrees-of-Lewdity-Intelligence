/**
 * IntentCapture — captures player action input variables (§3.3.1 step 1).
 *
 * Reads the current values of all combat action variables from SugarCube
 * state. These represent what the player chose to do this turn.
 *
 * IMPORTANT: Action variables ($leftaction, $rightaction, etc.) are reset
 * to 0 by <<turnend>> between combat turns. This capture is only meaningful
 * when called BEFORE <<turnend>> clears them. When called after, all
 * action fields will be 0 — intent-dependent events (humiliation,
 * boundary_request) cannot be extracted in that case.
 *
 * Runtime timing is handled by M3 lifecycle hooks in `src/init.ts`:
 * capture at `:passagestart`, consume at `:passageend`.
 */
import { safeRead, getV } from '../access.js';
import { BODY_ACTION_KEYS } from '../semantics/actions.js';
import type { IntentSnapshot } from './types.js';

/**
 * Capture the current player action intent from live game state.
 *
 * @returns IntentSnapshot, or null if SugarCube state is unavailable.
 */
export function captureIntent(): IntentSnapshot | null {
  const V = getV();
  if (!V) return null;

  return {
    leftaction: safeRead(() => V.leftaction, 0),
    rightaction: safeRead(() => V.rightaction, 0),
    mouthaction: safeRead(() => V.mouthaction, 0),
    feetaction: safeRead(() => V.feetaction, 0),
    penisaction: safeRead(() => V.penisaction, 0),
    vaginaaction: safeRead(() => V.vaginaaction, 0),
    anusaction: safeRead(() => V.anusaction, 0),
    chestaction: safeRead(() => V.chestaction, 0),
    thighaction: safeRead(() => V.thighaction, 0),
    askAction: safeRead(() => V.askAction, 0),
    mockaction: safeRead(() => V.mockaction, 0),
    mouthtarget: safeRead(() => V.mouthtarget, 0),
    lefttarget: safeRead(() => V.lefttarget, 0),
    righttarget: safeRead(() => V.righttarget, 0),
    feettarget: safeRead(() => V.feettarget, 0),
  };
}

/** Check whether an intent snapshot contains any non-zero action. */
export function hasActiveIntent(intent: IntentSnapshot): boolean {
  return BODY_ACTION_KEYS.some(k => intent[k] !== 0);
}
