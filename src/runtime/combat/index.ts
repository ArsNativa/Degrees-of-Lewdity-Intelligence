/**
 * Combat Narrator module — barrel export.
 *
 * Re-exports types and core components for the combat narration subsystem.
 */
export type {
  StateSnapshot,
  WorldSnapshot,
  PlayerSnapshot,
  NpcSnapshot,
  CombatSnapshot,
  ClothingSlotSnapshot,
  EntityAnchorState,
  MechanismEvent,
  IntentSnapshot,
  DeltaSnapshot,
  FieldChange,
  ClothingChange,
  ExtractionContext,
} from './types.js';

export { collectStateSnapshot } from './state-collector.js';
export { captureIntent, hasActiveIntent } from './intent-capture.js';
export { computeDelta } from './delta-computer.js';
export { normalizeEvents } from './event-normalizer.js';
export { EventExtractor } from './event-extractor.js';
export type { TurnExtractionResult } from './event-extractor.js';
