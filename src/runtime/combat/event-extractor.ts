/**
 * EventExtractor — orchestrates the mechanism event extraction pipeline (§3.3).
 *
 * Coordinates IntentCapture → StateSnapshot → DeltaComputer → EventNormalizer
 * to produce a list of MechanismEvent for each combat turn.
 *
 * Usage:
 *   const extractor = new EventExtractor();
 *   // ... each turn:
 *   const result = extractor.extractTurnEvents(anchorState, turnIndex);
 *
 * Session management: Call `reset()` when a new combat session begins.
 *
 * Timing model:
 *   Preferred flow is two-phase per passage-turn:
 *   1) `:passagestart` captures and latches intent
 *   2) `:passageend` calls extractTurnEvents() with the latched intent
 *
 *   For debug/manual calls, extractTurnEvents() still supports live intent
 *   capture if no latched intent is passed.
 */
import { Logger } from '../../utils/logger.js';
import { collectStateSnapshot } from './state-collector.js';
import { captureIntent, hasActiveIntent } from './intent-capture.js';
import { computeDelta } from './delta-computer.js';
import { normalizeEvents } from './event-normalizer.js';
import type {
  StateSnapshot,
  IntentSnapshot,
  MechanismEvent,
  EntityAnchorState,
  ExtractionContext,
  DeltaSnapshot,
} from './types.js';

const logger = new Logger('Combat/EventExtractor');

/** Result returned by the EventExtractor for one turn. */
export interface TurnExtractionResult {
  /** The turn index for this extraction. */
  turnIndex: number;
  /** Current state snapshot. */
  state: StateSnapshot;
  /** Intent snapshot (may contain all-zero if captured after <<turnend>>). */
  intent: IntentSnapshot;
  /** Delta from previous turn (null for first extraction). */
  delta: DeltaSnapshot | null;
  /** Normalized mechanism events (empty on first extraction). */
  events: MechanismEvent[];
  /** Whether intent was available (non-zero action variables). */
  intentAvailable: boolean;
  /** Where intent came from for this extraction. */
  intentSource: 'latched' | 'live';
}

export class EventExtractor {
  /** Previous turn's state snapshot for diffing. */
  private _prevState: StateSnapshot | null = null;
  /** Previous turn's intent (for reference). */
  private _prevIntent: IntentSnapshot | null = null;

  /**
   * Reset all stored state. Call when a new combat session begins.
   */
  reset(): void {
    this._prevState = null;
    this._prevIntent = null;
    logger.debug('EventExtractor reset');
  }

  /**
   * Extract mechanism events for the current turn.
   *
   * @param anchorState    Entity Anchor tracking (shared with StateCollector).
   * @param turnIndex      Current (mod-tracked) turn number.
   * @param latchedIntent  Optional intent captured at `:passagestart`.
   * @returns              Extraction result, or null if not in combat.
   */
  extractTurnEvents(
    anchorState: EntityAnchorState,
    turnIndex: number,
    latchedIntent?: IntentSnapshot | null,
  ): TurnExtractionResult | null {
    // 1. Resolve intent (prefer latched start-of-turn capture).
    const intentSource: 'latched' | 'live' = latchedIntent ? 'latched' : 'live';
    const intent = latchedIntent ?? captureIntent();
    if (!intent) {
      logger.warn('Cannot capture intent — SugarCube state unavailable');
      return null;
    }

    // 2. Collect current state snapshot.
    const state = collectStateSnapshot(anchorState, turnIndex);
    if (!state) {
      // Not in combat or state unavailable.
      return null;
    }

    const intentAvailable = hasActiveIntent(intent);
    let delta: DeltaSnapshot | null = null;
    let events: MechanismEvent[] = [];

    // 3. If we have a previous snapshot, compute delta and normalize events.
    if (this._prevState) {
      delta = computeDelta(this._prevState, state);

      const ctx: ExtractionContext = {
        intent,
        delta,
        prevState: this._prevState,
        currState: state,
      };

      events = normalizeEvents(ctx);

      if (!intentAvailable && intentSource === 'live') {
        logger.info(
          'Intent variables are zero (likely captured after <<turnend>>). ' +
          'Intent-dependent events (humiliation, boundary_request) may be missing.',
        );
      }

      logger.info(
        `Turn ${turnIndex}: extracted ${events.length} event(s)` +
        (intentAvailable ? '' : ' (no intent)') +
        ` [intent=${intentSource}]`,
      );
    } else {
      logger.info(`Turn ${turnIndex}: first extraction — no delta (baseline snapshot stored)`);
    }

    // 4. Store current state for next turn's diff.
    this._prevState = state;
    this._prevIntent = intent;

    return {
      turnIndex,
      state,
      intent,
      delta,
      events,
      intentAvailable,
      intentSource,
    };
  }
}
