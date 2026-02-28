/**
 * Combat narration display — parallel UI block management (§3.7).
 *
 * Inserts, updates, and removes AI narration blocks in the passage DOM.
 * Each block appears at the top of the passage and shows one of
 * three states: loading, success, or error.
 *
 * All DOM classes use the `doli-cn-` prefix (DOLI CombatNarrator).
 */
import { t } from '../utils/i18n/index.js';
import './styles.css';

const BLOCK_CLASS = 'doli-cn-block';

/** Options for creating a narration block. */
export interface NarrationBlockOptions {
  /** Current turn number (displayed in header). */
  turnIndex: number;
  /** Callback when the user clicks regenerate. Receives the block element. */
  onRegenerate?: (block: HTMLElement) => void;
  /** Whether auto-generation is currently enabled for this combat session. */
  autoGenerateEnabled?: boolean;
  /** Callback when the user toggles the auto-generate checkbox. */
  onToggleAutoGenerate?: (enabled: boolean) => void;
}

/**
 * Insert a narration block (loading state) at the top of the current passage.
 *
 * @returns The block element, or null if the passage container isn't found.
 */
export function insertNarrationBlock(
  opts: NarrationBlockOptions,
): HTMLElement | null {
  const {
    turnIndex,
    onRegenerate,
    autoGenerateEnabled = true,
    onToggleAutoGenerate,
  } = opts;
  // SugarCube renders passage content into `#passages .passage`
  const passage = document.querySelector('#passages .passage');
  if (!passage) return null;

  const block = document.createElement('div');
  block.className = `${BLOCK_CLASS} ${BLOCK_CLASS}--loading`;
  block.dataset.turn = String(turnIndex);

  // Header: label + turn number + regenerate + collapse toggle
  const header = document.createElement('div');
  header.className = 'doli-cn-header';

  const label = document.createElement('span');
  label.className = 'doli-cn-header-label';
  label.textContent = t('combat.narration_header');

  const turnTag = document.createElement('span');
  turnTag.className = 'doli-cn-header-turn';
  turnTag.textContent = `T${turnIndex}`;

  // Auto-generate checkbox
  const autoLabel = document.createElement('label');
  autoLabel.className = 'doli-cn-auto-label';
  autoLabel.title = t('combat.auto_generate_title');

  const autoCheckbox = document.createElement('input');
  autoCheckbox.type = 'checkbox';
  autoCheckbox.className = 'doli-cn-auto-checkbox';
  autoCheckbox.checked = autoGenerateEnabled;
  autoCheckbox.addEventListener('change', () => {
    if (onToggleAutoGenerate) onToggleAutoGenerate(autoCheckbox.checked);
  });

  const autoText = document.createTextNode(t('combat.auto_generate'));
  autoLabel.appendChild(autoCheckbox);
  autoLabel.appendChild(autoText);

  // Regenerate button
  const regenBtn = document.createElement('button');
  regenBtn.className = 'doli-cn-regen';
  regenBtn.textContent = t('combat.regenerate');
  regenBtn.title = t('combat.regenerate_title');
  regenBtn.addEventListener('click', () => {
    if (onRegenerate) onRegenerate(block);
  });

  const toggle = document.createElement('button');
  toggle.className = 'doli-cn-toggle';
  toggle.textContent = '▼';
  toggle.title = t('combat.toggle_collapse');
  toggle.addEventListener('click', () => {
    const collapsed = block.classList.toggle(`${BLOCK_CLASS}--collapsed`);
    toggle.textContent = collapsed ? '▶' : '▼';
  });

  header.appendChild(label);
  header.appendChild(turnTag);
  header.appendChild(autoLabel);
  header.appendChild(regenBtn);
  header.appendChild(toggle);

  // Body: initially shows loading text
  const body = document.createElement('div');
  body.className = 'doli-cn-body';
  body.textContent = t('combat.generating');

  block.appendChild(header);
  block.appendChild(body);
  passage.prepend(block);

  return block;
}

/**
 * Update a narration block to show the generated text (success state).
 */
export function renderNarrationSuccess(block: HTMLElement, text: string): void {
  block.className = BLOCK_CLASS;
  const body = block.querySelector('.doli-cn-body');
  if (body) body.textContent = text;
}

/**
 * Update a narration block to show an error message.
 */
export function renderNarrationError(block: HTMLElement, message: string): void {
  block.className = `${BLOCK_CLASS} ${BLOCK_CLASS}--error`;
  const body = block.querySelector('.doli-cn-body');
  if (body) body.textContent = `${t('combat.generation_failed')}: ${message}`;
}

/**
 * Reset a narration block back to loading state (used by regenerate).
 */
export function renderNarrationLoading(block: HTMLElement): void {
  block.className = `${BLOCK_CLASS} ${BLOCK_CLASS}--loading`;
  const body = block.querySelector('.doli-cn-body');
  if (body) body.textContent = t('combat.generating');
}

/**
 * Show a paused state when auto-generate is disabled.
 * The header (with checkbox + regenerate) remains interactive.
 */
export function renderNarrationPaused(block: HTMLElement): void {
  block.className = `${BLOCK_CLASS} ${BLOCK_CLASS}--paused`;
  const body = block.querySelector('.doli-cn-body');
  if (body) body.textContent = t('combat.auto_paused');
}
