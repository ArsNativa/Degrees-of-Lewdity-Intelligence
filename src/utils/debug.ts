/**
 * DebugConsole — comprehensive console debugging interface.
 *
 * Exposed via `window.doli.debug` for runtime inspection,
 * diagnostics, and manual tool invocation from the browser DevTools.
 *
 * Not part of the public API; may change without notice.
 */
import type { DoliMain } from '../init.js';
import type { StateSnapshot, TurnExtractionResult } from '../runtime/combat/index.js';
import type { BrowserSettings } from '../utils/settings/browser.js';
import type { SaveConfig } from '../utils/settings/save.js';
import type { NetworkCheckResult } from '../utils/network.js';
import type { UIMessage } from 'ai';
import type { ThreadMeta } from '../runtime/conversation.js';
import { Logger, LogLevel, MOD_NAME, MOD_VERSION } from './index.js';
import { createToolSet, getToolNames } from '../runtime/tools/index.js';
import { getLocale } from './i18n/index.js';

const logger = new Logger('Debug');

/**
 * Lazy-bound debug façade.
 *
 * We take a getter `() => DoliMain` instead of the instance
 * directly so the debug object can be constructed during `DoliMain`
 * constructor without forward-reference issues.
 */
export class DebugConsole {
  private readonly _getMain: () => DoliMain;

  constructor(getMain: () => DoliMain) {
    this._getMain = getMain;
  }

  private get main(): DoliMain { return this._getMain(); }

  // ──────────────────────────────────────────────────────────
  //  Info / Overview
  // ──────────────────────────────────────────────────────────

  /** Print mod version + status summary to console. */
  info(): Record<string, unknown> {
    const m = this.main;
    const bs = m.runtime.settings;
    const sc = m.runtime.saveConfig;
    const net = m.runtime.network.getLastResult();
    const conv = m.runtime.conversation;

    const summary = {
      mod: MOD_NAME,
      version: MOD_VERSION,
      apiConfigured: bs.isConfigured(),
      networkStatus: net.status,
      networkMessage: net.message,
      locale: getLocale(),
      activeThread: conv.getActiveThreadId(),
      threadCount: conv.getThreads().length,
      messageCount: conv.getMessages().length,
      combatId: m.combatNarrator.combatId || '(none)',
      combatTurn: m.combatNarrator.currentTurnIndex,
      enableAssistant: sc.get().enableAssistant,
      enableCombatNarrator: sc.get().enableCombatNarrator,
    };

    console.info(`[${MOD_NAME}/Debug] System info:`, summary);
    return summary;
  }

  /**
   * Print a quick-reference help listing all available debug commands.
   * Returns an array of { command, description } objects.
   */
  help(): Array<{ command: string; description: string }> {
    const commands = [
      // Info
      { command: 'debug.info()', description: 'Print mod version and status overview' },
      { command: 'debug.help()', description: 'Show this help listing' },

      // Settings
      { command: 'debug.getSettings()', description: 'Get browser-level settings (API key masked)' },
      { command: 'debug.getSaveConfig()', description: 'Get save-level configuration' },
      { command: 'debug.updateSettings(patch)', description: 'Update browser settings (e.g. { apiUrl: "..." })' },
      { command: 'debug.updateSaveConfig(patch)', description: 'Update save config (e.g. { enableAssistant: false })' },
      { command: 'debug.resetSettings()', description: 'Reset browser settings to defaults' },
      { command: 'debug.resetSaveConfig()', description: 'Reset save config to defaults' },
      { command: 'debug.getSaveConfigDefaults()', description: 'Show save config default values' },

      // Network
      { command: 'debug.networkCheck()', description: 'Re-run network diagnostics (async)' },
      { command: 'debug.networkStatus()', description: 'Show last network check result' },

      // Logger
      { command: 'debug.setLogLevel(level)', description: 'Set root logger level: 0=DEBUG 1=INFO 2=WARN 3=ERROR 4=SILENT' },

      // Conversation
      { command: 'debug.getMessages()', description: 'Get messages in active conversation thread' },
      { command: 'debug.getThreads()', description: 'List all conversation threads' },
      { command: 'debug.getActiveThreadId()', description: 'Get active thread ID' },
      { command: 'debug.clearConversation()', description: 'Clear current conversation thread (async)' },

      // Combat
      { command: 'debug.collectCombatState()', description: 'Snapshot current combat state' },
      { command: 'debug.extractCombatEvents()', description: 'Extract latest turn events' },
      { command: 'debug.renderCombatPrompt()', description: 'Render full combat prompt with macros' },
      { command: 'debug.getCombatInfo()', description: 'Get combat narrator status summary' },

      // Tools
      { command: 'debug.listTools()', description: 'List all available agent tools' },
      { command: 'debug.runTool(name, args?)', description: 'Execute a tool by name (async)' },
    ];

    console.table(commands);
    return commands;
  }

  // ──────────────────────────────────────────────────────────
  //  Settings
  // ──────────────────────────────────────────────────────────

  /** Get browser-level settings. API key is masked for safety. */
  getSettings(): BrowserSettings & { _apiKeyMasked: string } {
    const raw = this.main.runtime.settings.get();
    const masked = raw.apiKey
      ? raw.apiKey.slice(0, 4) + '****' + raw.apiKey.slice(-4)
      : '(empty)';
    return { ...raw, _apiKeyMasked: masked };
  }

  /** Get the full browser settings including unmasked API key. Use with caution. */
  getSettingsRaw(): BrowserSettings {
    logger.warn('Exposing raw settings including API key — avoid sharing console output!');
    return this.main.runtime.settings.get();
  }

  /** Get save-bound configuration. */
  getSaveConfig(): Readonly<SaveConfig> {
    return this.main.runtime.saveConfig.get();
  }

  /** Get save config default values. */
  getSaveConfigDefaults(): Readonly<SaveConfig> {
    return this.main.runtime.saveConfig.getDefaults();
  }

  /** Partially update browser settings. */
  async updateSettings(patch: Partial<BrowserSettings>): Promise<BrowserSettings> {
    logger.info('Updating browser settings via debug console:', patch);
    return this.main.runtime.settings.update(patch);
  }

  /** Partially update save config. */
  updateSaveConfig(patch: Partial<SaveConfig>): SaveConfig {
    logger.info('Updating save config via debug console:', patch);
    return this.main.runtime.saveConfig.update(patch);
  }

  /** Reset browser settings to defaults. */
  async resetSettings(): Promise<BrowserSettings> {
    const result = await this.main.runtime.settings.reset();
    logger.info('Browser settings reset to defaults');
    return result;
  }

  /** Reset save config to defaults. */
  resetSaveConfig(): SaveConfig {
    return this.main.runtime.saveConfig.reset();
  }

  // ──────────────────────────────────────────────────────────
  //  Network
  // ──────────────────────────────────────────────────────────

  /** Re-run network diagnostics against the currently configured API. */
  async networkCheck(): Promise<NetworkCheckResult> {
    const settings = this.main.runtime.settings.get();
    if (!settings.apiUrl) {
      logger.warn('No API URL configured — skipping network check');
      return this.main.runtime.network.getLastResult();
    }
    const result = await this.main.runtime.network.check(settings.apiUrl, settings.apiKey);
    console.info(`[${MOD_NAME}/Debug] Network check result:`, result);
    return result;
  }

  /** Get the last network check result. */
  networkStatus(): NetworkCheckResult {
    return this.main.runtime.network.getLastResult();
  }

  // ──────────────────────────────────────────────────────────
  //  Logger
  // ──────────────────────────────────────────────────────────

  /**
   * Set the log level of the global root logger.
   * 0=DEBUG, 1=INFO, 2=WARN, 3=ERROR, 4=SILENT
   *
   * Note: this only affects the root logger instance used
   * in debug output. Module-level loggers retain their own levels.
   */
  setLogLevel(level: LogLevel | number): void {
    const resolved = level as LogLevel;
    const names = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'SILENT'];
    logger.info(`Root log level → ${names[resolved] ?? resolved}`);
    logger.setLevel(resolved);
  }

  /** List available log level values. */
  get logLevels(): Record<string, number> {
    return {
      DEBUG: LogLevel.DEBUG,
      INFO: LogLevel.INFO,
      WARN: LogLevel.WARN,
      ERROR: LogLevel.ERROR,
      SILENT: LogLevel.SILENT,
    };
  }

  // ──────────────────────────────────────────────────────────
  //  Conversation
  // ──────────────────────────────────────────────────────────

  /** Get messages in the active conversation thread. */
  getMessages(): ReadonlyArray<UIMessage> {
    return this.main.runtime.conversation.getMessages();
  }

  /** List all conversation threads. */
  getThreads(): ReadonlyArray<ThreadMeta> {
    return this.main.runtime.conversation.getThreads();
  }

  /** Get active conversation thread ID. */
  getActiveThreadId(): string {
    return this.main.runtime.conversation.getActiveThreadId();
  }

  /** Clear the current conversation thread. */
  async clearConversation(): Promise<void> {
    await this.main.runtime.conversation.clear();
    logger.info('Conversation cleared');
  }

  // ──────────────────────────────────────────────────────────
  //  Combat (original debug methods + additions)
  // ──────────────────────────────────────────────────────────

  /** Snapshot current combat state. */
  collectCombatState(): StateSnapshot | null {
    return this.main.combatNarrator.collectCombatState();
  }

  /** Extract latest completed turn events. */
  extractCombatEvents(): TurnExtractionResult | null {
    return this.main.combatNarrator.extractCombatEvents();
  }

  /** Render full combat prompt with all macros replaced. */
  renderCombatPrompt(): string | null {
    return this.main.combatNarrator.debugRenderPrompt(
      this.main.runtime.saveConfig.get(),
    );
  }

  /** Get combat narrator status summary. */
  getCombatInfo(): Record<string, unknown> {
    const cn = this.main.combatNarrator;
    const config = this.main.runtime.saveConfig.get();
    return {
      combatId: cn.combatId || '(none)',
      currentTurn: cn.currentTurnIndex,
      historyWindow: config.combatHistoryWindowTurns,
      previousOutputs: cn.getPreviousOutputs(config.combatHistoryWindowTurns),
      enabled: config.enableCombatNarrator,
      mode: config.combatGenerationMode,
    };
  }

  // ──────────────────────────────────────────────────────────
  //  Tools
  // ──────────────────────────────────────────────────────────

  /** List all available agent tools by name. */
  listTools(): string[] {
    const names = getToolNames();
    console.info(`[${MOD_NAME}/Debug] ${names.length} tools available:`, names);
    return names;
  }

  /**
   * Execute a single tool by name.
   * @param name Tool name, e.g. 'get_player_status'
   * @param args Optional arguments object (e.g. { npcName: 'Robin' })
   */
  async runTool(name: string, args?: Record<string, unknown>): Promise<unknown> {
    const toolSet = createToolSet();
    const tool = (toolSet as Record<string, any>)[name];
    if (!tool) {
      const available = getToolNames();
      logger.error(`Unknown tool "${name}". Available: ${available.join(', ')}`);
      throw new Error(`Unknown tool: ${name}`);
    }

    logger.info(`Executing tool "${name}"...`, args ?? {});
    try {
      // AI SDK tools have an `execute` function taking the parsed args
      const result = await tool.execute(args ?? {});
      console.info(`[${MOD_NAME}/Debug] Tool "${name}" result:`, result);
      return result;
    } catch (err) {
      logger.error(`Tool "${name}" failed:`, err);
      throw err;
    }
  }

}
