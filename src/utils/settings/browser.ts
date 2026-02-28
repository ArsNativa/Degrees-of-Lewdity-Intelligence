/**
 * BrowserSettingsManager — browser-level configuration persistence via IndexedDB.
 *
 * Stores API connection details and network-related parameters.
 * These never travel with game saves (sensitive / machine-specific).
 */
import { Logger } from '../logger.js';
import { EventBus } from '../events.js';
import { idbGet, idbSet, initIDB } from '../idb.js';
import {
  IDB_SETTINGS_STORE,
  IDB_SETTINGS_KEY,
  DEFAULT_TOOL_TIMEOUT_MS,
  DEFAULT_REQUEST_TIMEOUT_MS,
} from '../constants.js';

export interface BrowserSettings {
  /** API base URL, e.g. https://api.openai.com/v1 */
  apiUrl: string;
  /** Bearer token */
  apiKey: string;
  /** Model identifier, e.g. gpt-5 */
  modelName: string;
  /** Per-tool timeout (ms) */
  toolTimeoutMs: number;
  /** Per-request timeout (ms) */
  requestTimeoutMs: number;
}

export type BrowserSettingsEventMap = {
  'settings-changed': [BrowserSettings];
};

const DEFAULT_SETTINGS: BrowserSettings = {
  apiUrl: '',
  apiKey: '',
  modelName: '',
  toolTimeoutMs: DEFAULT_TOOL_TIMEOUT_MS,
  requestTimeoutMs: DEFAULT_REQUEST_TIMEOUT_MS,
};

const logger = new Logger('Settings');

export class BrowserSettingsManager {
  private current: BrowserSettings = { ...DEFAULT_SETTINGS };
  readonly events = new EventBus<BrowserSettingsEventMap>();

  /** Get a snapshot of current settings. */
  get(): Readonly<BrowserSettings> {
    return { ...this.current };
  }

  /** Whether the minimum required fields (URL + key + model) are configured. */
  isConfigured(): boolean {
    return !!(this.current.apiUrl && this.current.apiKey && this.current.modelName);
  }

  /** Load persisted settings from IndexedDB. Falls back to defaults on error. */
  async load(): Promise<BrowserSettings> {
    try {
      await initIDB();
      const stored = await idbGet<BrowserSettings>(IDB_SETTINGS_STORE, IDB_SETTINGS_KEY);
      if (stored) {
        this.current = { ...DEFAULT_SETTINGS, ...stored };
        logger.info('Settings loaded from IndexedDB');
      } else {
        logger.info('No stored settings found, using defaults');
      }
    } catch (e) {
      logger.error('Failed to load settings:', e);
    }
    return this.get();
  }

  /** Persist a partial settings update. */
  async update(patch: Partial<BrowserSettings>): Promise<BrowserSettings> {
    this.current = { ...this.current, ...patch };
    try {
      await idbSet(IDB_SETTINGS_STORE, IDB_SETTINGS_KEY, this.current);
      logger.info('Settings saved');
    } catch (e) {
      logger.error('Failed to save settings:', e);
    }
    this.events.emit('settings-changed', this.get());
    return this.get();
  }

  /** Reset settings to defaults and clear persistence. */
  async reset(): Promise<BrowserSettings> {
    this.current = { ...DEFAULT_SETTINGS };
    try {
      await idbSet(IDB_SETTINGS_STORE, IDB_SETTINGS_KEY, this.current);
    } catch (_) { /* best-effort */ }
    this.events.emit('settings-changed', this.get());
    return this.get();
  }
}
