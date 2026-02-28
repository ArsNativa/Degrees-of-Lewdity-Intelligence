/**
 * OptionsTabRenderer — renders the DOLI settings form inside
 * the game's Options Overlay (#doli-game-settings container).
 *
 * Uses native DoL CSS classes (settingsGrid, settingsHeader,
 * settingsToggleItem, etc.) so the form blends seamlessly with
 * the General / Theme / Performance tabs.
 *
 * Two config sources:
 *   1. Browser config  → BrowserSettingsManager  (IndexedDB)
 *   2. Save config     → SaveConfigManager       (V.options.doli)
 */
import { t } from '../../i18n/index.js';
import { Logger } from '../../logger.js';
import { idbDeleteDatabase } from '../../idb.js';
import type { BrowserSettingsManager } from '../browser.js';
import type { SaveConfigManager } from '../save.js';
import { NetworkStatus } from '../../network.js';
import type { NetworkDiagnostics } from '../../network.js';
import { DEFAULT_COMBAT_PROMPT_TEMPLATE } from '../../../combat-narrator/renderer.js';
import { DEFAULT_SYSTEM_PROMPT } from '../../constants.js';

// Minimal custom styles (only for things with no native equivalent)
import './styles.css';

const logger = new Logger('OptionsTab');

export class OptionsTabRenderer {
  private settingsManager: BrowserSettingsManager;
  private saveConfigManager: SaveConfigManager;
  private network: NetworkDiagnostics;

  constructor(
    settingsManager: BrowserSettingsManager,
    saveConfigManager: SaveConfigManager,
    network: NetworkDiagnostics,
  ) {
    this.settingsManager = settingsManager;
    this.saveConfigManager = saveConfigManager;
    this.network = network;
  }

  /**
   * Render the settings form into #doli-game-settings.
   * Called from twee script: `window.doli?.renderOptionsTab?.()`.
   */
  render(): void {
    const container = document.getElementById('doli-game-settings');
    if (!container) {
      logger.warn('Container #doli-game-settings not found');
      return;
    }
    container.innerHTML = '';

    // Prevent keyboard events from bubbling to game handlers
    // (e.g. Enter triggering passage advance, arrow keys moving character).
    container.addEventListener('keydown', e => e.stopPropagation());
    container.addEventListener('keyup', e => e.stopPropagation());
    container.addEventListener('keypress', e => e.stopPropagation());

    // Action buttons (top, before all sections)
    container.appendChild(this.buildActionsSection());

    // API config section
    container.appendChild(this.buildApiSection());

    // Assistant config section
    container.appendChild(this.buildAssistantSection());

    // Combat narrator section
    container.appendChild(this.buildCombatSection());

    // Data control section
    container.appendChild(this.buildDataSection());

    logger.info('Options tab rendered');
  }

  // ── API Config Section ───────────────────────────────────

  private buildApiSection(): HTMLElement {
    const grid = document.createElement('div');
    grid.className = 'settingsGrid';

    this.appendHeader(grid, t('settings.section_browser'));

    // Note about local storage of API credentials
    const noteItem = document.createElement('div');
    noteItem.className = 'settingsToggleItemWide';
    const noteSpan = document.createElement('span');
    noteSpan.className = 'small-description';
    noteSpan.textContent = t('settings.api_config_note');
    noteItem.appendChild(noteSpan);
    grid.appendChild(noteItem);

    const settings = this.settingsManager.get();

    this.appendInputItem(grid, 'doli-opt-apiUrl', t('settings.api_url'), 'text',
      'https://api.openai.com/v1', settings.apiUrl);

    this.appendInputItem(grid, 'doli-opt-apiKey', t('settings.api_key'), 'password',
      'sk-...', settings.apiKey);

    this.appendInputItem(grid, 'doli-opt-modelName', t('settings.model_name'), 'text',
      'gpt-5', settings.modelName);

    this.appendTestButton(grid);

    return grid;
  }

  // ── Assistant Config Section ──────────────────────────────

  private buildAssistantSection(): HTMLElement {
    const grid = document.createElement('div');
    grid.className = 'settingsGrid';

    this.appendHeader(grid, t('settings.section_save'));

    const config = this.saveConfigManager.get();

    this.appendToggleItem(grid, 'doli-opt-enableAssistant', t('settings.enable_assistant'),
      config.enableAssistant);

    this.appendNumberItem(grid, 'doli-opt-maxSteps', t('settings.max_steps'),
      config.maxSteps, 1, 20);

    this.appendNumberItem(grid, 'doli-opt-assistantTemperature', t('settings.assistant_temperature'),
      config.assistantTemperature, 0, 2, 0.1);

    // System prompt — reusable prompt editor with per-field reset
    const displaySystemPrompt = config.systemPrompt || DEFAULT_SYSTEM_PROMPT;
    this.appendPromptEditor(grid, 'doli-opt-systemPrompt', t('settings.system_prompt'),
      t('settings.prompt_placeholder'), displaySystemPrompt, DEFAULT_SYSTEM_PROMPT);

    return grid;
  }

  // ── Combat Narrator Config Section ───────────────────────

  private buildCombatSection(): HTMLElement {
    const grid = document.createElement('div');
    grid.className = 'settingsGrid';

    this.appendHeader(grid, t('settings.section_combat'));

    // Note explaining parallel display
    const noteItem = document.createElement('div');
    noteItem.className = 'settingsToggleItemWide';
    const noteSpan = document.createElement('span');
    noteSpan.className = 'small-description';
    noteSpan.textContent = t('settings.combat_note');
    noteItem.appendChild(noteSpan);
    grid.appendChild(noteItem);

    const config = this.saveConfigManager.get();

    // Enable combat narrator toggle
    this.appendToggleItem(grid, 'doli-opt-enableCombatNarrator',
      t('settings.enable_combat_narrator'), config.enableCombatNarrator);

    // Generation mode — fixed to one_shot (hidden from UI)
    // ReAct mode reserved for future implementation; keep a hidden input so handleSave still reads the value.
    const modeInput = document.createElement('input');
    modeInput.type = 'hidden';
    modeInput.id = 'doli-opt-combatGenerationMode';
    modeInput.value = 'one_shot';
    grid.appendChild(modeInput);

    // Temperature
    this.appendNumberItem(grid, 'doli-opt-combatTemperature',
      t('settings.combat_temperature'), config.combatTemperature, 0, 2, 0.1);

    // Max tokens
    this.appendNumberItem(grid, 'doli-opt-combatMaxTokens',
      t('settings.combat_max_tokens'), config.combatMaxTokens, 64, 65536);

    // History window turns
    this.appendNumberItemWithDesc(grid, 'doli-opt-combatHistoryWindowTurns',
      t('settings.combat_history_window'), config.combatHistoryWindowTurns, 0, 20,
      t('settings.combat_history_window_desc'), undefined, 'settingsToggleItem');

    // Include original text
    this.appendToggleItemWithDesc(grid, 'doli-opt-combatIncludeOriginal',
      t('settings.combat_include_original'), config.combatIncludeOriginalText,
      t('settings.combat_include_original_desc'), 'settingsToggleItem');

    // Post-process regex pattern
    this.appendInputItemWithDesc(grid, 'doli-opt-combatPostProcessPattern',
      t('settings.combat_postprocess_pattern'), 'text', '/pattern/flags',
      config.combatPostProcessPattern, t('settings.combat_postprocess_pattern_desc'));

    // Post-process replacement
    this.appendInputItemWithDesc(grid, 'doli-opt-combatPostProcessReplacement',
      t('settings.combat_postprocess_replacement'), 'text', '',
      config.combatPostProcessReplacement, t('settings.combat_postprocess_replacement_desc'));

    // Prompt template — reusable prompt editor with per-field reset
    const displayTemplate = config.combatPromptTemplate || DEFAULT_COMBAT_PROMPT_TEMPLATE;
    this.appendPromptEditor(grid, 'doli-opt-combatPromptTemplate',
      t('settings.combat_prompt_template'),
      t('settings.combat_prompt_placeholder'), displayTemplate, DEFAULT_COMBAT_PROMPT_TEMPLATE);

    return grid;
  }

  // ── Actions Section ──────────────────────────────────────

  private buildActionsSection(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'doli-opt-actions';

    const saveBtn = document.createElement('button');
    saveBtn.textContent = t('settings.save');
    saveBtn.addEventListener('click', () => void this.handleSave());

    const resetBtn = document.createElement('button');
    resetBtn.className = 'doli-opt-btn-reset';
    resetBtn.textContent = t('settings.reset');
    resetBtn.addEventListener('click', () => void this.handleReset());

    const statusText = document.createElement('span');
    statusText.id = 'doli-opt-status';
    statusText.className = 'doli-opt-status';

    wrap.appendChild(saveBtn);
    wrap.appendChild(resetBtn);
    wrap.appendChild(statusText);

    return wrap;
  }

  // ── Data Control Section ─────────────────────────────────

  private buildDataSection(): HTMLElement {
    const grid = document.createElement('div');
    grid.className = 'settingsGrid';

    this.appendHeader(grid, t('settings.section_data'));

    // ── Clear browser data ──────────────────────────────
    const browserItem = document.createElement('div');
    browserItem.className = 'settingsToggleItemWide';

    const browserDesc = document.createElement('span');
    browserDesc.className = 'small-description';
    browserDesc.textContent = t('settings.clear_browser_data_desc');
    browserItem.appendChild(browserDesc);

    const browserRow = document.createElement('div');
    browserRow.style.marginTop = '6px';
    browserRow.style.display = 'flex';
    browserRow.style.alignItems = 'center';
    browserRow.style.gap = '8px';
    browserRow.style.flexWrap = 'wrap';

    const browserBtn = document.createElement('button');
    browserBtn.textContent = t('settings.clear_browser_data');
    const browserStatusEl = document.createElement('span');
    browserStatusEl.className = 'doli-opt-status';
    browserBtn.addEventListener('click', () => void this.handleClearBrowserData(browserStatusEl));

    browserRow.appendChild(browserBtn);
    browserRow.appendChild(browserStatusEl);
    browserItem.appendChild(browserRow);
    grid.appendChild(browserItem);

    // ── Clear save data ─────────────────────────────────
    const saveItem = document.createElement('div');
    saveItem.className = 'settingsToggleItemWide';

    const saveDesc = document.createElement('span');
    saveDesc.className = 'small-description';
    saveDesc.textContent = t('settings.clear_save_data_desc');
    saveItem.appendChild(saveDesc);

    const saveRow = document.createElement('div');
    saveRow.style.marginTop = '6px';
    saveRow.style.display = 'flex';
    saveRow.style.alignItems = 'center';
    saveRow.style.gap = '8px';
    saveRow.style.flexWrap = 'wrap';

    const saveBtn = document.createElement('button');
    saveBtn.textContent = t('settings.clear_save_data');
    const saveStatusEl = document.createElement('span');
    saveStatusEl.className = 'doli-opt-status';
    saveBtn.addEventListener('click', () => void this.handleClearSaveData(saveStatusEl));

    saveRow.appendChild(saveBtn);
    saveRow.appendChild(saveStatusEl);
    saveItem.appendChild(saveRow);
    grid.appendChild(saveItem);

    return grid;
  }

  private async handleClearBrowserData(statusEl: HTMLElement): Promise<void> {
    if (!confirm(t('settings.clear_browser_data_confirm'))) return;

    try {
      await idbDeleteDatabase();
      await this.settingsManager.reset();
      statusEl.textContent = t('settings.clear_browser_data_done');
      logger.info('Browser mod data cleared (IndexedDB deleted, in-memory reset)');
    } catch (e) {
      logger.error('Failed to clear browser data:', e);
      statusEl.textContent = String(e);
    }
  }

  private handleClearSaveData(statusEl: HTMLElement): void {
    if (!confirm(t('settings.clear_save_data_confirm'))) return;

    try {
      this.saveConfigManager.purge();
      statusEl.textContent = t('settings.clear_save_data_done');
      logger.info('Save mod data purged');
    } catch (e) {
      logger.error('Failed to clear save data:', e);
      statusEl.textContent = String(e);
    }
  }

  // ── DOM Helpers ──────────────────────────────────────────

  private appendHeader(parent: HTMLElement, text: string): void {
    const header = document.createElement('div');
    header.className = 'settingsHeader options';
    const span = document.createElement('span');
    span.className = 'gold';
    span.textContent = text;
    header.appendChild(span);
    parent.appendChild(header);
  }

  private appendInputItem(
    parent: HTMLElement, id: string, label: string,
    type: string, placeholder: string, value: string,
  ): void {
    const item = document.createElement('div');
    item.className = 'settingsToggleItemWide';

    const row = document.createElement('div');
    row.className = 'doli-opt-field-row';

    const lbl = this.createControlLabel(id, label);

    const input = document.createElement('input');
    input.id = id;
    input.type = type;
    input.placeholder = placeholder;
    input.value = value;
    input.style.flex = '1 1 260px';
    input.style.minWidth = '0';
    input.style.boxSizing = 'border-box';

    row.appendChild(lbl);
    row.appendChild(input);
    item.appendChild(row);
    parent.appendChild(item);
  }

  private appendNumberItem(
    parent: HTMLElement, id: string, label: string,
    value: number, min: number, max: number, step?: number,
  ): void {
    const item = document.createElement('div');
    item.className = 'settingsToggleItem';

    const row = document.createElement('div');
    row.className = 'doli-opt-field-row';

    const lbl = this.createControlLabel(id, label);

    const input = document.createElement('input');
    input.id = id;
    input.type = 'number';
    input.min = String(min);
    input.max = String(max);
    if (step !== undefined) input.step = String(step);
    input.value = String(value);
    input.style.width = '80px';
    input.style.minWidth = '0';

    row.appendChild(lbl);
    row.appendChild(input);
    item.appendChild(row);
    parent.appendChild(item);
  }

  private appendSelectItem(
    parent: HTMLElement, id: string, label: string,
    value: string, options: { value: string; label: string }[],
  ): void {
    const item = document.createElement('div');
    item.className = 'settingsToggleItem';

    const row = document.createElement('div');
    row.className = 'doli-opt-field-row';

    const lbl = this.createControlLabel(id, label);

    const select = document.createElement('select');
    select.id = id;
    select.style.minWidth = '8em';
    select.style.maxWidth = '100%';
    select.style.flex = '1 1 10em';
    for (const opt of options) {
      const option = document.createElement('option');
      option.value = opt.value;
      option.textContent = opt.label;
      if (opt.value === value) option.selected = true;
      select.appendChild(option);
    }

    row.appendChild(lbl);
    row.appendChild(select);
    item.appendChild(row);
    parent.appendChild(item);
  }

  private appendToggleItem(
    parent: HTMLElement, id: string, label: string, checked: boolean,
  ): void {
    const item = document.createElement('div');
    item.className = 'settingsToggleItem';

    const lbl = document.createElement('label');

    const input = document.createElement('input');
    input.id = id;
    input.type = 'checkbox';
    input.checked = checked;

    lbl.appendChild(input);
    lbl.appendChild(document.createTextNode(' ' + label));

    item.appendChild(lbl);
    parent.appendChild(item);
  }

  /**
   * Reusable prompt editor: label + textarea + per-field reset button,
   * all in one `settingsToggleItemWide` container.
   */
  private appendPromptEditor(
    parent: HTMLElement, id: string, label: string,
    placeholder: string, value: string, defaultValue: string,
  ): void {
    const item = document.createElement('div');
    item.className = 'settingsToggleItemWide';

    const lbl = this.createControlLabel(id, label);
    lbl.className = 'doli-opt-field-label doli-opt-field-label-block';
    item.appendChild(lbl);

    const textarea = document.createElement('textarea');
    textarea.id = id;
    textarea.rows = 4;
    textarea.placeholder = placeholder;
    textarea.value = value;
    textarea.style.width = '100%';
    textarea.style.boxSizing = 'border-box';
    textarea.style.resize = 'vertical';
    textarea.style.minHeight = '60px';
    item.appendChild(textarea);

    const resetBtn = document.createElement('button');
    resetBtn.className = 'doli-opt-prompt-reset';
    resetBtn.textContent = t('settings.reset_prompt');
    resetBtn.addEventListener('click', () => { textarea.value = defaultValue; });
    item.appendChild(resetBtn);

    parent.appendChild(item);
  }

  private appendNumberItemWithDesc(
    parent: HTMLElement, id: string, label: string,
    value: number, min: number, max: number, desc: string, step?: number,
    itemClassName: 'settingsToggleItem' | 'settingsToggleItemWide' = 'settingsToggleItemWide',
  ): void {
    const item = document.createElement('div');
    item.className = itemClassName;

    const row = document.createElement('div');
    row.className = 'doli-opt-field-row';

    const lbl = this.createControlLabel(id, label);

    const input = document.createElement('input');
    input.id = id;
    input.type = 'number';
    input.min = String(min);
    input.max = String(max);
    if (step !== undefined) input.step = String(step);
    input.value = String(value);
    input.style.width = '80px';
    input.style.minWidth = '0';

    row.appendChild(lbl);
    row.appendChild(input);
    item.appendChild(row);

    const descEl = document.createElement('span');
    descEl.className = 'small-description';
    descEl.style.opacity = '0.7';
    descEl.textContent = desc;
    item.appendChild(descEl);

    parent.appendChild(item);
  }

  private appendToggleItemWithDesc(
    parent: HTMLElement, id: string, label: string,
    checked: boolean, desc: string,
    itemClassName: 'settingsToggleItem' | 'settingsToggleItemWide' = 'settingsToggleItemWide',
  ): void {
    const item = document.createElement('div');
    item.className = itemClassName;

    const row = document.createElement('div');
    row.className = 'doli-opt-field-row';

    const input = document.createElement('input');
    input.id = id;
    input.type = 'checkbox';
    input.checked = checked;

    const lbl = document.createElement('label');
    lbl.appendChild(input);
    lbl.appendChild(document.createTextNode(' ' + label));

    row.appendChild(lbl);
    item.appendChild(row);

    const descEl = document.createElement('span');
    descEl.className = 'small-description';
    descEl.style.opacity = '0.7';
    descEl.textContent = desc;
    item.appendChild(descEl);

    parent.appendChild(item);
  }

  private appendInputItemWithDesc(
    parent: HTMLElement, id: string, label: string,
    type: string, placeholder: string, value: string, desc: string,
  ): void {
    const item = document.createElement('div');
    item.className = 'settingsToggleItemWide';

    const row = document.createElement('div');
    row.className = 'doli-opt-field-row';

    const lbl = this.createControlLabel(id, label);

    const input = document.createElement('input');
    input.id = id;
    input.type = type;
    input.placeholder = placeholder;
    input.value = value;
    input.style.flex = '1 1 260px';
    input.style.minWidth = '0';
    input.style.boxSizing = 'border-box';

    row.appendChild(lbl);
    row.appendChild(input);
    item.appendChild(row);

    const descEl = document.createElement('span');
    descEl.className = 'small-description';
    descEl.style.opacity = '0.7';
    descEl.textContent = desc;
    item.appendChild(descEl);

    parent.appendChild(item);
  }

  /**
   * Parse a regex literal string like `/pattern/flags` into a RegExp.
   * Returns null if the format is invalid or the regex cannot be compiled.
   */
  private parseRegexLiteral(literal: string): RegExp | null {
    const match = /^\/(.+)\/([gimsuy]*)$/.exec(literal);
    if (!match) return null;
    try {
      return new RegExp(match[1], match[2]);
    } catch {
      return null;
    }
  }

  private createControlLabel(id: string, label: string): HTMLLabelElement {
    const lbl = document.createElement('label');
    lbl.className = 'doli-opt-field-label';
    lbl.htmlFor = id;
    lbl.textContent = this.formatControlLabel(label);
    return lbl;
  }

  private formatControlLabel(label: string): string {
    const trimmed = label.trim().replace(/[：:]\s*$/, '');
    const separator = /[\u3400-\u9FFF]/.test(trimmed) ? '：' : ':';
    return `${trimmed}${separator}`;
  }

  private appendTestButton(parent: HTMLElement): void {
    const item = document.createElement('div');
    item.className = 'settingsToggleItemWide';

    const btn = document.createElement('button');
    btn.textContent = t('settings.test_connection');

    const statusEl = document.createElement('span');
    statusEl.className = 'doli-opt-test-status';
    statusEl.id = 'doli-opt-testStatus';

    // Show last known status
    const lastResult = this.network.getLastResult();
    this.updateTestStatus(statusEl, lastResult.status, lastResult.message);

    btn.addEventListener('click', async () => {
      statusEl.textContent = t('status.checking');
      statusEl.className = 'doli-opt-test-status doli-opt-status-unknown';

      // Read current field values (may not be saved yet)
      const urlInput = document.getElementById('doli-opt-apiUrl') as HTMLInputElement | null;
      const keyInput = document.getElementById('doli-opt-apiKey') as HTMLInputElement | null;
      const url = urlInput?.value.trim() || '';
      const key = keyInput?.value.trim() || '';

      if (!url) {
        this.updateTestStatus(statusEl, NetworkStatus.NOT_CONFIGURED, t('status.not_configured'));
        return;
      }

      const result = await this.network.check(url, key);
      this.updateTestStatus(statusEl, result.status, result.message);
    });

    item.appendChild(btn);
    item.appendChild(statusEl);
    parent.appendChild(item);
  }

  private updateTestStatus(el: HTMLElement, status: NetworkStatus, message: string): void {
    el.textContent = message;
    let modifier = 'unknown';
    switch (status) {
      case NetworkStatus.OK: modifier = 'ok'; break;
      case NetworkStatus.API_AUTH_ERROR: modifier = 'warn'; break;
      case NetworkStatus.NOT_CONFIGURED:
      case NetworkStatus.UNKNOWN: modifier = 'unknown'; break;
      default: modifier = 'error'; break;
    }
    el.className = `doli-opt-test-status doli-opt-status-${modifier}`;
  }

  // ── Actions ──────────────────────────────────────────────

  private async handleSave(): Promise<void> {
    // 1. Read browser config fields
    const apiUrl = (document.getElementById('doli-opt-apiUrl') as HTMLInputElement)?.value.trim() ?? '';
    const apiKey = (document.getElementById('doli-opt-apiKey') as HTMLInputElement)?.value.trim() ?? '';
    const modelName = (document.getElementById('doli-opt-modelName') as HTMLInputElement)?.value.trim() ?? '';

    // 2. Save save-bound config first (sync, immediate).
    // This avoids losing save-bound fields if user refreshes before async IDB write completes.
    const enableAssistant = (document.getElementById('doli-opt-enableAssistant') as HTMLInputElement)?.checked ?? true;
    const maxSteps = parseInt(
      (document.getElementById('doli-opt-maxSteps') as HTMLInputElement)?.value ?? '6', 10,
    ) || 6;
    const assistantTemperature = this.clamp(
      this.parseNumericInput('doli-opt-assistantTemperature', 0.7),
      0, 2,
    );
    const rawSystemPrompt = (document.getElementById('doli-opt-systemPrompt') as HTMLTextAreaElement)?.value.trim() ?? '';
    // If user hasn't changed the default prompt, store empty (= "use default")
    const systemPrompt = rawSystemPrompt === DEFAULT_SYSTEM_PROMPT.trim()
      ? ''
      : rawSystemPrompt;

    // 2b. Save save-bound config (combat narrator)
    const enableCombatNarrator = (document.getElementById('doli-opt-enableCombatNarrator') as HTMLInputElement)?.checked ?? false;
    const combatGenerationMode = ((document.getElementById('doli-opt-combatGenerationMode') as HTMLSelectElement)?.value ?? 'one_shot') as 'one_shot' | 'react';
    const combatTemperature = this.clamp(
      this.parseNumericInput('doli-opt-combatTemperature', 0.7),
      0, 2,
    );
    const combatMaxTokens = this.clamp(
      Math.round(this.parseNumericInput('doli-opt-combatMaxTokens', 4096)),
      64, 65536,
    );
    const combatHistoryWindowTurns = this.clamp(
      Math.round(this.parseNumericInput('doli-opt-combatHistoryWindowTurns', 3)),
      0, 20,
    );
    const combatIncludeOriginalText = (document.getElementById('doli-opt-combatIncludeOriginal') as HTMLInputElement)?.checked ?? false;
    const combatPostProcessPattern = (document.getElementById('doli-opt-combatPostProcessPattern') as HTMLInputElement)?.value.trim() ?? '';
    const combatPostProcessReplacement = (document.getElementById('doli-opt-combatPostProcessReplacement') as HTMLInputElement)?.value ?? '';
    // Validate regex pattern if non-empty
    if (combatPostProcessPattern) {
      const parsed = this.parseRegexLiteral(combatPostProcessPattern);
      if (!parsed) {
        this.showStatus(t('settings.combat_postprocess_invalid'));
        return;
      }
    }
    const rawCombatPromptTemplate = (document.getElementById('doli-opt-combatPromptTemplate') as HTMLTextAreaElement)?.value.trim() ?? '';
    // If user hasn't changed the default template, store empty (= "use default")
    const combatPromptTemplate = rawCombatPromptTemplate === DEFAULT_COMBAT_PROMPT_TEMPLATE.trim()
      ? ''
      : rawCombatPromptTemplate;

    this.saveConfigManager.update({
      enableAssistant, maxSteps, assistantTemperature, systemPrompt,
      enableCombatNarrator, combatGenerationMode, combatTemperature,
      combatMaxTokens, combatHistoryWindowTurns,
      combatIncludeOriginalText, combatPromptTemplate,
      combatPostProcessPattern, combatPostProcessReplacement,
    });

    // 3. Persist browser config (async IndexedDB write).
    await this.settingsManager.update({ apiUrl, apiKey, modelName });

    // Apply enableAssistant immediately
    this.applyAssistantVisibility(enableAssistant);

    this.showStatus(t('settings.saved'));
    logger.info('Settings saved via Options tab');
  }

  private async handleReset(): Promise<void> {
    await this.settingsManager.reset();
    const defaults = this.saveConfigManager.reset();

    // Apply enableAssistant from reset defaults
    this.applyAssistantVisibility(defaults.enableAssistant);

    this.render();
    this.showStatus(t('settings.reset_done'));
    logger.info('Settings reset via Options tab');
  }

  private showStatus(message: string): void {
    const el = document.getElementById('doli-opt-status');
    if (el) {
      el.textContent = message;
    }
  }

  /** Show or hide the assistant floating button & panel based on config. */
  private applyAssistantVisibility(enabled: boolean): void {
    const assistant = (window as any).doli?.assistant;
    if (!assistant) return;
    if (enabled) {
      assistant.attach();
    } else {
      assistant.detach();
    }
  }

  /** Clamp a number to [min, max]. */
  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  /**
   * Read a numeric input value, returning `fallback` if the field is empty,
   * missing, or not a valid number.
   */
  private parseNumericInput(id: string, fallback: number): number {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (!el) return fallback;
    const raw = el.value.trim();
    if (raw === '') return fallback;
    const num = Number(raw);
    return Number.isFinite(num) ? num : fallback;
  }
}
