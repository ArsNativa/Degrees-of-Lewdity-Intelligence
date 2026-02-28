/**
 * DOLI — main webpack entry point.
 *
 * This file is bundled as `dist/DOLI.js` and loaded via
 * `scriptFileList_inject_early` in boot.json.
 *
 * It creates the global `window.doli` instance that the
 * earlyload and preload boot scripts interact with.
 */
import { Assistant } from './assistant/index.js';
import { CombatNarrator } from './combat-narrator/index.js';
import { Runtime } from './runtime/index.js';
import { Logger, MOD_NAME, MOD_VERSION } from './utils/index.js';
import { DebugConsole } from './utils/debug.js';

const logger = new Logger(MOD_NAME);

export class DoliMain {
  readonly assistant: Assistant;
  readonly combatNarrator: CombatNarrator;
  readonly runtime: Runtime;

  /**
   * Debug namespace — exposed for console-based verification.
   * Use `window.doli.debug.help()` for a full command listing.
   * Not part of the public API; may change without notice.
   */
  readonly debug: DebugConsole;

  constructor() {
    this.runtime = new Runtime();
    this.assistant = new Assistant(this.runtime);
    this.combatNarrator = new CombatNarrator(this.runtime);

    // Wire up debug console (lazy-bound to avoid forward-reference issues)
    this.debug = new DebugConsole(() => this);
  }

  /**
   * Async initialisation — called during the earlyload phase.
   *
   * Loads persisted settings from IndexedDB and runs network diagnostics.
   */
  async init(): Promise<void> {
    logger.info('Initialising...');
    await this.runtime.init();
    logger.info('Initialisation complete');
  }

  /**
   * Attach UI to the DOM — called during `:storyready`.
   */
  attach(): void {
    this.runtime.saveConfig.ensureInit();

    // Always attach combat narrator, as it's a background system that collects combat states.
    // The options only control whether it produces output or not.
    this.combatNarrator.attach();

    // Only attach assistant UI if enabled in save config
    const config = this.runtime.saveConfig.get();
    if (config.enableAssistant) {
      this.assistant.attach();
    }
  }

  /**
   * Render the settings form inside the Options Overlay tab.
   * Called from the twee patch: `window.doli?.renderOptionsTab?.()`.
   */
  renderOptionsTab(): void {
    this.runtime.optionsTab.render();
  }
}

// ── Bootstrap ──

const doli = new DoliMain();
(window as any).doli = doli;

logger.info(`${MOD_NAME} v${MOD_VERSION} loaded (inject_early)`);
