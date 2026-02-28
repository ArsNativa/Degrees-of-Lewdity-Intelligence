/**
 * Assistant module — top-level entry for the intelligent assistant feature.
 *
 * Manages the floating button and chat panel lifecycle.
 * Called from the main DOLI init during the `:storyready` phase.
 */
import { Logger } from '../utils/logger.js';
import type { Runtime } from '../runtime/index.js';
import { FloatButton } from './ui/float-button.js';
import { ChatPanel } from './ui/chat-panel.js';

// Import styles — webpack bundles them via style-loader
import './ui/styles.css';

const logger = new Logger('Assistant');

export class Assistant {
  private runtime: Runtime;
  private floatButton: FloatButton | null = null;
  private chatPanel: ChatPanel | null = null;

  constructor(runtime: Runtime) {
    this.runtime = runtime;
  }

  /**
   * Attach UI to the DOM.
   * Should be called once during `:storyready`.
   */
  attach(): void {
    if (this.floatButton) {
      logger.warn('Already attached');
      return;
    }

    this.chatPanel = new ChatPanel(this.runtime);
    this.floatButton = new FloatButton(() => this.toggle());

    this.chatPanel.mount();
    this.floatButton.mount();

    logger.info('UI attached');
  }

  /** Toggle the chat panel open/closed. */
  toggle(): void {
    this.chatPanel?.toggle();
  }

  /** Detach UI from the DOM. */
  detach(): void {
    this.floatButton?.unmount();
    this.chatPanel?.unmount();
    this.floatButton = null;
    this.chatPanel = null;
    logger.info('UI detached');
  }
}
