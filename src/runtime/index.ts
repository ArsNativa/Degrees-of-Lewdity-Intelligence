/**
 * Runtime — public façade for agent infrastructure.
 *
 * Exposes settings, network diagnostics, LLM client, agent, and conversation state.
 */
import { Logger } from '../utils/logger.js';
import { BrowserSettingsManager } from '../utils/settings/index.js';
import { SaveConfigManager } from '../utils/settings/index.js';
import { NetworkDiagnostics } from '../utils/network.js';
import { OptionsTabRenderer } from '../utils/settings/index.js';
import { LLMClient } from './llm.js';
import { ConversationManager } from './conversation.js';
import { Agent } from './agent.js';

export { BrowserSettingsManager } from '../utils/settings/index.js';
export type { BrowserSettings } from '../utils/settings/index.js';
export { SaveConfigManager } from '../utils/settings/index.js';
export type { SaveConfig } from '../utils/settings/index.js';
export { NetworkDiagnostics, NetworkStatus, NetworkCheckResult, getStatusMessage } from '../utils/network.js';
export { LLMClient, LLMError, LLMErrorType } from './llm.js';
export type { ChatMessage, LLMStreamCallbacks, LLMGenerateOptions } from './llm.js';
export { ConversationManager } from './conversation.js';
export type {
  ThreadMeta,
} from './conversation.js';
export type { UIMessage } from 'ai';
export { Agent } from './agent.js';
export type { AgentCallbacks, AgentRunOptions, AgentRunResult, ToolCallInfo, ToolResultInfo, StepInfo } from './agent.js';
export { createToolSet, getToolNames } from './tools/index.js';
export type { AgentToolSet } from './tools/index.js';
export { collectStateSnapshot, EventExtractor } from './combat/index.js';
export { captureIntent, computeDelta, normalizeEvents } from './combat/index.js';
export type {
  StateSnapshot, WorldSnapshot, PlayerSnapshot, NpcSnapshot,
  CombatSnapshot, ClothingSlotSnapshot, EntityAnchorState,
  MechanismEvent, IntentSnapshot, DeltaSnapshot,
  FieldChange, ClothingChange, ExtractionContext,
} from './combat/index.js';
export type { TurnExtractionResult } from './combat/index.js';

const logger = new Logger('Runtime');

export class Runtime {
  readonly settings: BrowserSettingsManager;
  readonly saveConfig: SaveConfigManager;
  readonly network: NetworkDiagnostics;
  readonly llm: LLMClient;
  readonly conversation: ConversationManager;
  readonly agent: Agent;
  readonly optionsTab: OptionsTabRenderer;

  constructor() {
    this.settings = new BrowserSettingsManager();
    this.saveConfig = new SaveConfigManager();
    this.network = new NetworkDiagnostics();
    this.llm = new LLMClient();
    this.conversation = new ConversationManager();
    this.agent = new Agent();
    this.optionsTab = new OptionsTabRenderer(this.settings, this.saveConfig, this.network);
  }

  /**
   * Async initialisation — called during earlyload phase.
   *
   * 1. Load persisted settings.
   * 2. Load persisted conversation.
   * 3. If configured, run network diagnostics.
   */
  async init(): Promise<void> {
    logger.info('Initialising runtime...');
    const settings = await this.settings.load();
    await this.conversation.load();

    if (this.settings.isConfigured()) {
      await this.network.check(settings.apiUrl, settings.apiKey);
    } else {
      logger.info('API not configured — skipping network check');
    }
    logger.info('Runtime initialised');
  }
}
