/**
 * Shared helper utilities for game-state Tool implementations.
 *
 * Tool-specific utilities only: logger and schema helpers.
 * Game-state access → import from `../helpers.js`
 * Semantic mappings → import from `../semantics/index.js`
 */
import { jsonSchema } from 'ai';
import { Logger } from '../../utils/logger.js';

export const toolLogger = new Logger('Tools');

// ── Schema Helpers ──────────────────────────────────────────

/** Empty parameter schema — for tools that take no arguments. */
export const emptyParams = jsonSchema<Record<string, never>>({
  type: 'object' as const,
  properties: {},
});
