/**
 * SaveConfigManager — manages save-bound configuration via SugarCube story variables.
 *
 * Single source of truth: `V.options.doli`.
 * Browser-only settings are handled separately by BrowserSettingsManager.
 */
import { Logger } from '../logger.js';
import { DEFAULT_MAX_STEPS } from '../constants.js';

const logger = new Logger('SaveConfig');

/** Combat narration generation mode. */
export type CombatGenerationMode = 'one_shot' | 'react';

/** Configuration that persists with the game save. */
export interface SaveConfig {
  // ── Assistant ──────────────────────────────────────────
  /** Whether the assistant floating window is enabled. */
  enableAssistant: boolean;
  /** Custom system prompt override (empty string = use built-in default). */
  systemPrompt: string;
  /** Maximum ReAct tool-call steps per agent run. */
  maxSteps: number;
  /** Sampling temperature for assistant replies (0–2). */
  assistantTemperature: number;

  // ── Combat Narrator ────────────────────────────────────
  /** Enable per-turn AI narration during combat (parallel display, does not replace original text). */
  enableCombatNarrator: boolean;
  /** Generation mode: one-shot prompt or ReAct with tools. */
  combatGenerationMode: CombatGenerationMode;
  /** Prompt template override (empty string = use built-in default). */
  combatPromptTemplate: string;
  /** Sampling temperature for combat narration (0–2). */
  combatTemperature: number;
  /** Maximum output tokens for combat narration (64–65536). */
  combatMaxTokens: number;
  /** Number of recent AI outputs injected into {{PreviousNarration}} (0 = none). */
  combatHistoryWindowTurns: number;
  /** Whether to collect and inject current-turn original text into {{OriginalText}}. */
  combatIncludeOriginalText: boolean;
  /** Post-processing regex pattern applied to LLM output before display (empty = disabled). Format: /pattern/flags */
  combatPostProcessPattern: string;
  /** Replacement string for post-processing regex ($1, $2 etc. supported). */
  combatPostProcessReplacement: string;
}

const DEFAULTS: Readonly<SaveConfig> = {
  // Assistant
  enableAssistant: true,
  systemPrompt: '',
  maxSteps: DEFAULT_MAX_STEPS,
  assistantTemperature: 0.7,
  // Combat Narrator
  enableCombatNarrator: false,
  combatGenerationMode: 'one_shot',
  combatPromptTemplate: '',
  combatTemperature: 0.8,
  combatMaxTokens: 4096,
  combatHistoryWindowTurns: 5,
  combatIncludeOriginalText: false,
  combatPostProcessPattern: '',
  combatPostProcessReplacement: '',
};

export class SaveConfigManager {
  /**
   * Read the current save config, merging defaults for missing fields.
   * Safe when SugarCube state is not available.
   */
  get(): Readonly<SaveConfig> {
    const V = this.getVariables();
    return this.composeConfig(V?.options?.doli);
  }

  /** Update one or more fields in save config. */
  update(patch: Partial<SaveConfig>): SaveConfig {
    const next = this.composeConfig({ ...this.get(), ...patch });
    this.writeToSV(next);
    logger.info('Save config updated');
    return next;
  }

  /** Reset save config to defaults. */
  reset(): SaveConfig {
    const next = this.composeConfig();
    this.writeToSV(next);
    logger.info('Save config reset to defaults');
    return next;
  }

  /**
   * Completely remove mod config from the save variable.
   * Unlike `reset()` which writes defaults back, this deletes the key entirely.
   */
  purge(): void {
    const V = this.getVariables();
    if (!V) {
      logger.warn('SugarCube state not available — save config purge skipped');
      return;
    }
    if (V.options) {
      delete V.options.doli;
    }

    // Also clean the active history frame
    const state = (window as any).SugarCube?.State;
    const history = Array.isArray(state?.history) ? state.history : null;
    const activeIndex = typeof state?.activeIndex === 'number' ? state.activeIndex : -1;
    if (history && activeIndex >= 0 && activeIndex < history.length) {
      const frame = history[activeIndex];
      if (frame?.variables?.options) {
        delete frame.variables.options.doli;
      }
    }

    this.persistSessionState();
    logger.info('Save config purged (key deleted from save)');
  }

  /**
   * Ensure the save variable is initialized.
   * Call during `:storyready` so `V.options.doli` always exists.
   */
  ensureInit(): void {
    const V = this.getVariables();
    if (!V) return;
    const next = this.composeConfig(V.options?.doli);
    this.writeToSV(next);
  }

  /** Expose defaults for external consumers (e.g. settings UI renderer). */
  getDefaults(): Readonly<SaveConfig> {
    return { ...DEFAULTS };
  }

  // ── Private helpers ──────────────────────────────────────

  private composeConfig(raw?: Partial<SaveConfig>): SaveConfig {
    return { ...DEFAULTS, ...(raw ?? {}) };
  }

  private writeToSV(config: SaveConfig): void {
    const V = this.getVariables();
    if (!V) {
      logger.warn('SugarCube state not available — save config write skipped');
      return;
    }
    if (!V.options) V.options = {} as any;

    const next = this.composeConfig(config);
    V.options.doli = { ...next };

    // Keep the active history frame in sync so Save export/import sees
    // the same value even before a passage transition.
    this.syncActiveHistoryFrame(next);

    // Flush to SugarCube session so browser refresh keeps the latest value.
    this.persistSessionState();
  }

  private getVariables(): any {
    return (window as any).SugarCube?.State?.variables;
  }

  private syncActiveHistoryFrame(config: SaveConfig): void {
    const state = (window as any).SugarCube?.State;
    const history = Array.isArray(state?.history) ? state.history : null;
    const activeIndex = typeof state?.activeIndex === 'number' ? state.activeIndex : -1;

    if (!history || activeIndex < 0 || activeIndex >= history.length) {
      return;
    }

    const frame = history[activeIndex];
    if (!frame?.variables) return;

    if (!frame.variables.options) frame.variables.options = {};
    frame.variables.options.doli = { ...config };
  }

  private persistSessionState(): void {
    const sugarCube = (window as any).SugarCube;
    const state = sugarCube?.State;
    const session = sugarCube?.session;
    if (!state || !session) return;
    if (typeof state.marshalForSave !== 'function' || typeof session.set !== 'function') return;

    try {
      const sessionState = state.marshalForSave(undefined, false);
      if (!sessionState) return;
      if (typeof state.qc !== 'undefined') {
        sessionState.idx = state.qc;
      }
      session.set('state', sessionState);
    } catch (error) {
      logger.warn('Failed to persist SugarCube session state:', error);
    }
  }
}
