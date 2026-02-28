/**
 * Settings module barrel — re-exports everything related to configuration.
 *
 * Two config layers:
 *   - BrowserSettingsManager  (IndexedDB, per-browser, never in save file)
 *   - SaveConfigManager       (SugarCube story variables, travels with save)
 *
 * UI:
 *   - OptionsTabRenderer      (renders settings form in game Options overlay)
 */
export { BrowserSettingsManager } from './browser.js';
export type { BrowserSettings, BrowserSettingsEventMap } from './browser.js';
export { SaveConfigManager } from './save.js';
export type { SaveConfig, CombatGenerationMode } from './save.js';
export { OptionsTabRenderer } from './ui/index.js';
