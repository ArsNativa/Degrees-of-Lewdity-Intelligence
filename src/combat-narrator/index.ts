/**
 * CombatNarrator module — top-level entry for combat narration feature.
 *
 * Responsibilities:
 * - M3: Turn-level lifecycle orchestration (`:passagestart` / `:passageend`).
 * - M4: Narrative History management (combat_id, turn outputs, sliding window).
 * - M5: One Shot generation orchestration + parallel UI display.
 *
 * Reusable extraction logic remains in `runtime/combat/*`.
 * Prompt macro rendering lives in `./renderer.ts`.
 * UI block management lives in `./display.ts`.
 */
import { Logger } from '../utils/logger.js';
import { t } from '../utils/i18n/index.js';
import { collectStateSnapshot, EventExtractor, captureIntent } from '../runtime/combat/index.js';
import type {
  EntityAnchorState,
  StateSnapshot,
  IntentSnapshot,
  TurnExtractionResult,
} from '../runtime/combat/index.js';
import { renderPrompt, DEFAULT_COMBAT_PROMPT_TEMPLATE } from './renderer.js';
import type { PromptRenderContext, NarrativeEntry, PreCombatContext } from './renderer.js';
import {
  insertNarrationBlock,
  renderNarrationSuccess,
  renderNarrationError,
  renderNarrationLoading,
  renderNarrationPaused,
} from './display.js';
import type { Runtime } from '../runtime/index.js';

// ── Passage text extraction & cleaning ────────────────────────────────

/** Default character limit for cleaned passage text. */
const DEFAULT_PASSAGE_TEXT_LIMIT = 500;

/** HTML tags whose entire subtree is removed when extracting narrative text. */
const SKIP_TAGS = new Set([
  'A', 'BUTTON', 'SELECT', 'INPUT', 'TEXTAREA', 'LABEL',
]);

/**
 * Element IDs whose entire subtree is removed when extracting narrative text.
 *
 * These cover two categories of non-narrative content rendered inside
 * `#passages .passage`:
 *
 * 1. **PassageFooter UI** — version display, export warning, settings
 *    overlay, achievement/debug panels.
 * 2. **Combat action UI** — the action-selection menu, combat settings
 *    toggle, and debug panels rendered by `<<generateActionsMan>>` /
 *    `<<printCombatMenu>>`.
 */
const SKIP_IDS = new Set([
  // PassageFooter
  'gameVersionDisplay',       // "0.5.8.9 -(ML-v2.101.1)"
  'gameVersionDisplay2',      // ".5.8.9"
  'exportWarning',            // "You haven't exported your save…"
  'customOverlayContainer',   // Settings / options overlay
  'feat',                     // Achievement display
  'debugOverlay',             // Debug overlay
  // Combat action UI
  'cbtToggleMenu',            // Combat menu toggle panel
  'listContainer',            // All body-part action lists
  'replaceAction',            // "Replace action" link container
  'combatDebug',              // Combat debug panel
]);

/**
 * Extract narrative-only text from a rendered passage DOM tree.
 *
 * Works by **cloning** the subtree and **removing** all known non-narrative
 * elements (interactive tags like `<a>/<button>`, and UI containers
 * identified by {@link SKIP_IDS}) before reading `textContent`.
 *
 * The clone-and-strip approach (vs. TreeWalker) handles sibling pollution
 * naturally — e.g. translation-mod elements injected between footer divs.
 *
 * @param root  A `DocumentFragment` or `Element` (not mutated).
 * @returns     Concatenated text of narrative-only nodes.
 */
function extractNarrativeText(root: DocumentFragment | Element): string {
  // Clone to avoid mutating the live DOM.
  const clone = root.cloneNode(true) as Element;

  // Remove known UI containers by ID (entire subtree removed).
  for (const id of SKIP_IDS) {
    clone.querySelector(`#${id}`)?.remove();
  }

  // Remove interactive elements by tag name.
  for (const tag of SKIP_TAGS) {
    clone.querySelectorAll(tag.toLowerCase()).forEach(el => el.remove());
  }

  return clone.textContent || '';
}

/**
 * Collapse whitespace, strip non-narrative residue, and truncate.
 *
 * Runs on the output of {@link extractNarrativeText} (which has already
 * removed interactive-element and UI-container text at the DOM level).
 * This post-processing catches text-level noise that DOM filtering misses:
 *
 * - Orphaned `|` separators (leftover from removed link groups).
 * - Game / ModLoader version patterns (e.g. `0.5.8.9`, `-(ML-v2.101.1)`).
 * - Trailing "Next" residue.
 *
 * @param raw       Pre-filtered text.
 * @param maxLen    Maximum character length to keep (default 500).
 * @returns         Cleaned, possibly truncated text.
 */
function trimPassageText(
  raw: string,
  maxLen: number = DEFAULT_PASSAGE_TEXT_LIMIT,
): string {
  let text = raw.replace(/\s+/g, ' ').trim();

  // Strip orphaned pipe separators (from removed link groups / section dividers).
  text = text.replace(/(\s*\|\s*)+/g, ' ').trim();

  // Strip game version patterns: "0.5.8.9", "-(ML-v2.101.1)", ".5.8.9"
  text = text.replace(/\d+\.\d+\.\d+\.\d+/g, '').trim();
  text = text.replace(/-\(ML-v[\d.]+\)/g, '').trim();

  // Strip trailing "Next".
  text = text.replace(/\s*Next\s*$/, '').trim();

  if (text.length > maxLen) {
    text = '…' + text.slice(text.length - maxLen);
  }
  return text;
}
import type { SaveConfig } from '../utils/settings/save.js';
import type { ChatMessage, LLMGenerateOptions } from '../runtime/llm.js';
import { classifyError } from '../runtime/llm.js';

const logger = new Logger('CombatNarrator');

export class CombatNarrator {
  /** Reference to the shared Runtime (LLM client, settings). */
  private _runtime: Runtime;

  /** Entity Anchor state — tracks NPC display-name continuity across turns. */
  private _anchorState: EntityAnchorState = {
    initialNames: new Map(),
    prevNames: new Map(),
    hintedSwitches: new Set(),
  };

  /** Mod-tracked turn counter (DoL has none built-in). */
  private _turnIndex = 0;
  /** Whether the previous call was inside an active combat. */
  private _wasCombatActive = false;
  /** Event extractor for mechanism event extraction (§3.3). */
  private _eventExtractor = new EventExtractor();
  /** Intent latched at `:passagestart` for current turn extraction. */
  private _pendingIntent: IntentSnapshot | null = null;
  /** Latest completed turn extraction (produced at `:passageend`). */
  private _latestTurnExtraction: TurnExtractionResult | null = null;
  /** Whether lifecycle hooks are already bound. */
  private _hooksBound = false;
  /** AbortController for the in-flight LLM generation (if any). */
  private _generationAbort: AbortController | null = null;
  /** Per-session flag: when false, skip generation for subsequent turns. */
  private _sessionAutoGenerate = true;
  /** Turn index of the last successfully recorded narrative output (-1 = none). */
  private _lastRecordedTurnIndex = -1;

  // ── Narrative History (§3.2 / M4) ──────────────────────────

  /** Unique identifier for the current combat session. */
  private _combatId = '';
  /** Ordered list of AI narrative outputs for the current combat (one per successful turn). */
  private _narrativeOutputs: NarrativeEntry[] = [];
  /** Pre-combat context captured once at combat session start. */
  private _preCombatContext: PreCombatContext | null = null;

  // ── Outgoing passage stash (captured at :passagestart via DOM) ─────
  /** Passage name of the outgoing passage (stashed before new passage renders). */
  private _lastOutgoingPassageName = '';
  /** Rendered text of the outgoing passage (stashed before new passage renders). */
  private _lastOutgoingText = '';

  constructor(runtime: Runtime) {
    this._runtime = runtime;
  }

  // ── Public API — Narrative History ──────────────────────────

  /** Current combat session identifier (empty when not in combat). */
  get combatId(): string { return this._combatId; }

  /** Current mod-tracked turn index. */
  get currentTurnIndex(): number { return this._turnIndex; }

  /**
   * Record a successful AI narrative output for the given turn.
   * Called by M5 after generation succeeds and the text is rendered.
   */
  addNarrativeOutput(turnIndex: number, text: string): void {
    this._narrativeOutputs.push({ turnIndex, text });
    logger.debug(
      `Output added (turn=${turnIndex}, total=${this._narrativeOutputs.length})`,
    );
  }

  /**
   * Replace the most recent AI narrative output (used by regeneration).
   * If no outputs exist yet, falls back to appending.
   */
  replaceLastNarrativeOutput(turnIndex: number, text: string): void {
    if (this._narrativeOutputs.length > 0) {
      this._narrativeOutputs[this._narrativeOutputs.length - 1] = { turnIndex, text };
      logger.debug(`Output replaced (turn=${turnIndex})`);
    } else {
      this.addNarrativeOutput(turnIndex, text);
    }
  }

  /**
   * Get the most recent K AI outputs for `{{PreviousNarration}}`.
   * Returns at most `windowK` entries (fewer if not enough history).
   */
  getPreviousOutputs(windowK: number): NarrativeEntry[] {
    if (windowK <= 0) return [];
    return this._narrativeOutputs.slice(-windowK);
  }

  // ── Lifecycle ──────────────────────────────────────────────

  /**
   * Attach lifecycle hooks once.
   * Called during `:storyready`.
   */
  attach(): void {
    this._ensureHooksBound();
  }

  /**
   * Debug helper: collect combat state with session boundary detection.
   */
  collectCombatState(): StateSnapshot | null {
    this._syncCombatSessionState();
    return collectStateSnapshot(this._anchorState, this._turnIndex);
  }

  /**
   * Debug helper: return latest completed extraction (read-only).
   */
  extractCombatEvents(): TurnExtractionResult | null {
    const combatActive = this._syncCombatSessionState();
    if (!combatActive) return null;

    if (!this._latestTurnExtraction) {
      logger.info(
        'No completed extraction for current passage yet. ' +
        'Wait until passage render finishes.',
      );
    }

    return this._latestTurnExtraction;
  }

  /**
   * Debug helper: render the full prompt for the latest completed turn.
   *
   * Returns the prompt string with all macros replaced, or null if no
   * extraction is available (not in combat or no completed turn).
   *
   * @param config SaveConfig for template and feature flags.
   */
  debugRenderPrompt(config: SaveConfig): string | null {
    if (!this._latestTurnExtraction) {
      logger.info('No completed extraction — cannot render prompt');
      return null;
    }

    const ext = this._latestTurnExtraction;
    const template = config.combatPromptTemplate || DEFAULT_COMBAT_PROMPT_TEMPLATE;
    const windowK = config.combatHistoryWindowTurns;

    const ctx: PromptRenderContext = {
      state: ext.state,
      events: ext.events,
      intent: ext.intent,
      delta: ext.delta,
      turnIndex: ext.turnIndex,
      previousOutputs: this.getPreviousOutputs(windowK),
      includeOriginalText: config.combatIncludeOriginalText,
      originalText: '',  // M5 will provide actual original text
      preCombatContext: this._preCombatContext,
    };

    return renderPrompt(template, ctx);
  }

  /** Generate a short unique combat session ID. */
  private _newCombatId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  /** Reset all combat session tracking state. */
  private _resetCombatSession(): void {
    // Entity Anchor
    this._anchorState.initialNames.clear();
    this._anchorState.prevNames.clear();
    this._anchorState.hintedSwitches.clear();
    // Turn tracking
    this._turnIndex = 0;
    this._pendingIntent = null;
    this._latestTurnExtraction = null;
    this._eventExtractor.reset();
    // Narrative History
    this._combatId = this._newCombatId();
    this._narrativeOutputs = [];
    this._sessionAutoGenerate = true;
    this._lastRecordedTurnIndex = -1;
    // Pre-combat context: use values stashed at the most recent :passagestart
    // (when the old DOM was still present, before the combat passage rendered).
    this._preCombatContext = this._buildPreCombatContext();
    logger.debug(
      `New combat session — tracking state reset (combatId=${this._combatId})`,
    );
    if (this._preCombatContext) {
      logger.info(
        `Pre-combat context captured: passage="${this._preCombatContext.passageName}", ` +
        `textLen=${this._preCombatContext.renderedText.length}`,
      );
    }
  }

  /**
   * Build PreCombatContext from the stashed outgoing passage data.
   * The stash is populated every `:passagestart` before the new passage renders.
   */
  private _buildPreCombatContext(): PreCombatContext | null {
    const passageName = this._lastOutgoingPassageName;
    const renderedText = this._lastOutgoingText;

    if (!passageName && !renderedText) return null;

    return { passageName, renderedText };
  }

  /**
   * Stash the outgoing passage's name & rendered text.
   *
   * Called at every `:passagestart`.  At this point the old passage's DOM
   * is still in `#passages .passage` and `$passage` still holds the previous
   * passage name (PassageHeader hasn't run yet).
   */
  private _stashOutgoingPassage(): void {
    const V = (window as any).SugarCube?.State?.variables;
    this._lastOutgoingPassageName = V?.passage ?? '';

    const passageEl = document.querySelector('#passages .passage');
    this._lastOutgoingText = passageEl
      ? trimPassageText(extractNarrativeText(passageEl))
      : '';
  }

  /**
   * Keep combat-session state in sync with live SugarCube state.
   */
  private _syncCombatSessionState(): boolean {
    const V = (window as any).SugarCube?.State?.variables;
    const combatActive = V?.combat === 1;

    if (combatActive && !this._wasCombatActive) {
      this._resetCombatSession();
    } else if (!combatActive && this._wasCombatActive) {
      // _pendingIntent / _latestTurnExtraction 不在此清理 —
      // 后续 passage handler 的非战斗分支会处理。
      // 只清理 narrative history（释放内存）和 combatId（信号量）。
      logger.debug(
        `Combat session ended (combatId=${this._combatId}, turns=${this._narrativeOutputs.length})`,
      );
      this._combatId = '';
      this._narrativeOutputs = [];
      this._preCombatContext = null;
    }

    this._wasCombatActive = combatActive;
    return combatActive;
  }

  /**
   * Bind lifecycle hooks used by M3 extraction.
   */
  private _ensureHooksBound(): void {
    if (this._hooksBound) return;

    const jq = (window as any).jQuery ?? (window as any).$;
    if (typeof jq !== 'function') {
      logger.warn('Cannot bind hooks: jQuery unavailable');
      return;
    }

    // ── jQuery passage lifecycle events ──
    const $doc = jq(document);
    $doc.on(':passagestart', () => this._onPassageStart());
    $doc.on(':passageend', () => this._onPassageEnd());
    this._hooksBound = true;
    logger.info('Hooks bound (:passagestart/:passageend)');
  }

  /**
   * Passage start handler: latch intent before turn logic clears action vars.
   * Also aborts any in-flight generation from the previous turn.
   *
   * IMPORTANT: At `:passagestart` the old passage's DOM is still in
   * `#passages .passage` and `$passage` still holds the old name.
   * We stash the DOM text unconditionally so that if `$combat` is set
   * during the *render* of the incoming passage, `_resetCombatSession()`
   * (which fires at `:passageend`) can use the correct pre-combat content.
   */
  private _onPassageStart(): void {
    // Abort any in-flight LLM generation (previous turn)
    if (this._generationAbort) {
      this._generationAbort.abort();
      this._generationAbort = null;
    }

    // Stash outgoing passage info (old DOM is still present at :passagestart).
    this._stashOutgoingPassage();

    this._latestTurnExtraction = null;

    const combatActive = this._syncCombatSessionState();
    if (!combatActive) {
      this._pendingIntent = null;
      return;
    }

    const intent = captureIntent();
    this._pendingIntent = intent;

    if (!intent) {
      logger.warn('Failed to capture intent at :passagestart');
      return;
    }

    logger.info('Intent captured at :passagestart');
  }

  /**
   * Passage end handler: compute delta, normalize events, and trigger generation.
   */
  private _onPassageEnd(): void {
    const combatActive = this._syncCombatSessionState();
    if (!combatActive) {
      this._pendingIntent = null;
      return;
    }

    const result = this._eventExtractor.extractTurnEvents(
      this._anchorState,
      this._turnIndex,
      this._pendingIntent,
    );
    this._pendingIntent = null;

    if (!result) return;

    this._latestTurnExtraction = result;
    this._turnIndex += 1;

    logger.info(
      `turn=${result.turnIndex} events=${result.events.length} intent=${result.intentSource}`,
    );

    // M5: Fire-and-forget async generation (never blocks passage flow)
    void this._maybeGenerateNarration(result);
  }

  // ── M5: One Shot Generation ────────────────────────────────

  /**
   * Orchestrate one-shot narration generation for a completed turn.
   *
   * Checks config, builds prompt, calls LLM, and updates the UI block.
   * Runs asynchronously — never blocks the passage transition.
   * Errors are caught and displayed in the UI block; combat flow
   * is never interrupted (§3.8.2 constraint).
   */
  private async _maybeGenerateNarration(
    extraction: TurnExtractionResult,
  ): Promise<void> {
    // ── Pre-checks ──
    const config = this._runtime.saveConfig.get();
    if (!config.enableCombatNarrator) return;

    // M5 only handles one_shot; ReAct handled by M6
    if (config.combatGenerationMode !== 'one_shot') {
      logger.debug('Generation mode is not one_shot — skipping');
      return;
    }

    const settings = this._runtime.settings.get();
    if (!settings.apiUrl || !settings.apiKey || !settings.modelName) {
      logger.warn('LLM not configured — skipping narration');
      return;
    }

    // Session-level auto-generate toggle (controlled by in-block checkbox)
    // Even when paused, we still insert a block so the user can re-enable.
    const autoEnabled = this._sessionAutoGenerate;

    // ── Collect original text (if enabled, before we insert our block) ──
    let originalText = '';
    if (config.combatIncludeOriginalText) {
      originalText = this._collectOriginalText();
    }

    // ── Insert loading block into DOM with regenerate callback ──
    const block = insertNarrationBlock({
      turnIndex: extraction.turnIndex,
      onRegenerate: (blk) => {
        this._handleRegenerate(blk, extraction, originalText);
      },
      autoGenerateEnabled: this._sessionAutoGenerate,
      onToggleAutoGenerate: (enabled) => {
        this._sessionAutoGenerate = enabled;
        logger.info(`Auto-generate ${enabled ? 'enabled' : 'disabled'} for this combat session`);
      },
    });
    if (!block) {
      logger.warn('Could not insert narration block — passage container not found');
      return;
    }

    // If auto-generate is disabled, show paused state instead of calling LLM
    if (!autoEnabled) {
      renderNarrationPaused(block);
      logger.debug('Auto-generate disabled for this session — block shown as paused');
      return;
    }

    // ── Run LLM generation on the block ──
    await this._runGenerationOnBlock(block, extraction, originalText, false);
  }

  /**
   * Regenerate callback: reset block to loading state and re-run generation.
   * Replaces the last narrative output on success (instead of appending).
   */
  private _handleRegenerate(
    block: HTMLElement,
    extraction: TurnExtractionResult,
    originalText: string,
  ): void {
    // Abort any in-flight generation
    if (this._generationAbort) {
      this._generationAbort.abort();
      this._generationAbort = null;
    }

    renderNarrationLoading(block);
    void this._runGenerationOnBlock(block, extraction, originalText, true);
  }

  /**
   * Core LLM generation logic — shared by initial generation and regeneration.
   *
   * @param block         Target DOM block to update
   * @param extraction    Turn extraction result (events, state, intent)
   * @param originalText  Original passage text (or empty)
   * @param isRegenerate  If true, replaces the last narrative output instead of appending
   */
  private async _runGenerationOnBlock(
    block: HTMLElement,
    extraction: TurnExtractionResult,
    originalText: string,
    isRegenerate: boolean,
  ): Promise<void> {
    const config = this._runtime.saveConfig.get();
    const settings = this._runtime.settings.get();

    // ── Build prompt ──
    const template = config.combatPromptTemplate || DEFAULT_COMBAT_PROMPT_TEMPLATE;
    const windowK = config.combatHistoryWindowTurns;

    // When regenerating a turn that already has a recorded output,
    // exclude that output from the sliding window so the LLM doesn't
    // see (and be influenced by) the unsatisfactory previous attempt.
    const isCurrentTurnRecorded = this._lastRecordedTurnIndex === extraction.turnIndex;
    const previousOutputs = isCurrentTurnRecorded
      ? this._narrativeOutputs.slice(0, -1).slice(-windowK)
      : this.getPreviousOutputs(windowK);

    const ctx: PromptRenderContext = {
      state: extraction.state,
      events: extraction.events,
      intent: extraction.intent,
      delta: extraction.delta,
      turnIndex: extraction.turnIndex,
      previousOutputs,
      includeOriginalText: config.combatIncludeOriginalText,
      originalText,
      preCombatContext: this._preCombatContext,
    };

    const prompt = renderPrompt(template, ctx);

    // ── Call LLM ──
    const abort = new AbortController();
    this._generationAbort = abort;

    const messages: ChatMessage[] = [
      { role: 'user', content: prompt },
    ];

    const llmOptions: LLMGenerateOptions = {
      temperature: config.combatTemperature,
      maxTokens: config.combatMaxTokens,
    };

    try {
      logger.info(`${isRegenerate ? 'Regenerating' : 'Generating'} narration for turn ${extraction.turnIndex}...`);

      const text = await this._runtime.llm.chat(
        messages,
        settings,
        abort.signal,
        llmOptions,
      );

      // Check if aborted while waiting
      if (abort.signal.aborted) return;

      if (text && text.trim()) {
        // Apply post-processing regex if configured.
        // If regex config is invalid, do not fall back to raw text:
        // fail this block so history never records unprocessed output.
        const processed = this._applyPostProcessRegex(text.trim(), config);
        if (processed == null) {
          const msg = 'Invalid post-process regex config';
          renderNarrationError(block, t('combat.generation_failed'), msg);
          logger.warn(msg);
          return;
        }
        // Decide add vs replace: only replace if we already recorded an output
        // for this exact turn (i.e. user clicked regenerate after a prior success).
        if (this._lastRecordedTurnIndex === extraction.turnIndex) {
          this.replaceLastNarrativeOutput(extraction.turnIndex, processed);
        } else {
          this.addNarrativeOutput(extraction.turnIndex, processed);
          this._lastRecordedTurnIndex = extraction.turnIndex;
        }
        renderNarrationSuccess(block, processed);
        logger.info(`Narration ${isRegenerate ? 'regenerated' : 'generated'} (turn=${extraction.turnIndex}, len=${processed.length})`);      } else {
        renderNarrationError(block, t('combat.generation_failed'), 'Empty response from LLM');
        logger.warn('LLM returned empty text for narration');
      }
    } catch (err: unknown) {
      // AbortError is expected when passage changes mid-generation
      if (err instanceof DOMException && err.name === 'AbortError') {
        logger.debug('Narration generation aborted (passage changed)');
        return;
      }
      // Classify into structured LLMError
      const llmError = classifyError(err);
      logger.error('Narration generation failed:', llmError.type, llmError.message);
      // Update block only if it's still in the DOM
      if (block.isConnected) {
        renderNarrationError(block, llmError.message, llmError.detail);
      }
    } finally {
      if (this._generationAbort === abort) {
        this._generationAbort = null;
      }
    }
  }

  /**
   * Return the current passage's narrative text.
   *
   * At `:passageend` the DOM `#passages .passage` contains the fully
   * rendered current passage.  We use clone-and-strip to extract
   * narrative-only text, filtering out interactive controls and UI.
   */
  private _collectOriginalText(): string {
    const passageEl = document.querySelector('#passages .passage');
    if (!passageEl) return '';
    return trimPassageText(extractNarrativeText(passageEl));
  }

  /**
   * Apply post-processing regex to LLM output text.
   * Returns null when regex config is invalid, so caller can fail safely
   * instead of storing unprocessed raw text into narrative history.
   */
  private _applyPostProcessRegex(text: string, config: SaveConfig): string | null {
    const pattern = config.combatPostProcessPattern;
    if (!pattern) return text;

    const match = /^\/(.+)\/([gimsuy]*)$/.exec(pattern);
    if (!match) {
      logger.warn('Post-process regex format invalid');
      return null;
    }

    try {
      const regex = new RegExp(match[1], match[2]);
      const result = text.replace(regex, config.combatPostProcessReplacement);
      if (result !== text) {
        logger.debug('Post-process regex applied');
      }
      return result;
    } catch (err) {
      logger.warn('Post-process regex failed:', err instanceof Error ? err.message : String(err));
      return null;
    }
  }
}

