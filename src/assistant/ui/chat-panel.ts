/**
 * Chat panel — side-panel UI for the intelligent assistant.
 *
 * Displays the message list, thread drawer, and input area.
 * Settings are managed via the Options Overlay tab (see utils/settings/ui/).
 */
import { CSS_PREFIX, DEFAULT_SYSTEM_PROMPT } from '../../utils/constants.js';
import { Logger } from '../../utils/logger.js';
import { t } from '../../utils/i18n/index.js';
import type { Runtime } from '../../runtime/index.js';
import { NetworkStatus } from '../../utils/network.js';
import { LLMError, LLMErrorType } from '../../runtime/llm.js';
import type { UIMessage } from 'ai';
import type {
  ToolCallInfo,
  ToolResultInfo,
  StepInfo,
} from '../../runtime/agent.js';
import type {
  ThreadMeta,
} from '../../runtime/conversation.js';
import { nativeStringify } from '../../utils/safe-json.js';
import { renderMarkdown, StreamThrottle } from '../../utils/markdown.js';

type AssistantDom = {
  root: HTMLDivElement;
  reasoningWrap: HTMLDivElement;
  reasoningText: HTMLPreElement;
  toolsWrap: HTMLDivElement;
  textEl: HTMLDivElement;
};

type LiveAssistantState = AssistantDom & {
  textBuffer: string;
  reasoningBuffer: string;
  callIdByTool: Map<string, string>;
  inputByCallId: Map<string, unknown>;
  toolCardByCallId: Map<string, HTMLDetailsElement>;
  streamThrottle: StreamThrottle;
};

type ToolCardStatus = 'input' | 'success' | 'error' | 'denied' | 'approval';

type ToolCardView = {
  tool: string;
  callId: string;
  status: ToolCardStatus;
  input?: unknown;
  output?: unknown;
  error?: string;
};

const logger = new Logger('ChatPanel');

export class ChatPanel {
  private runtime: Runtime;
  private root: HTMLDivElement | null = null;

  // Sub-elements
  private statusBtn!: HTMLButtonElement;
  private bodyEl!: HTMLDivElement;
  private messagesEl!: HTMLDivElement;
  private threadBackdrop!: HTMLDivElement;
  private threadDrawer!: HTMLDivElement;
  private threadListEl!: HTMLDivElement;
  private inputArea!: HTMLDivElement;
  private inputEl!: HTMLTextAreaElement;
  private sendBtn!: HTMLButtonElement;

  private isOpen = false;
  private isThreadDrawerOpen = false;

  /** Whether we're currently waiting for an LLM response. */
  private isSending = false;

  /** AbortController for the current in-flight request. */
  private abortController: AbortController | null = null;

  /** Current streaming assistant block (UI-only live state). */
  private liveAssistant: LiveAssistantState | null = null;

  /** Cleanup callbacks for event subscriptions. */
  private cleanupFns: Array<() => void> = [];

  private callFallbackCounter = 0;

  constructor(runtime: Runtime) {
    this.runtime = runtime;
  }

  // ── Lifecycle ──────────────────────────────────────────────

  mount(): void {
    if (this.root) return;

    this.root = this.buildDOM();
    document.body.appendChild(this.root);

    this.refreshStatus();
    this.refreshThreadList();
    this.renderConversation();

    this.cleanupFns.push(
      this.runtime.settings.events.on('settings-changed', () => {
        this.refreshStatus();
        this.renderConversation();
      }),
      this.runtime.conversation.events.on('threads-changed', () => {
        this.refreshThreadList();
      }),
    );

    logger.info('Chat panel mounted');
  }

  unmount(): void {
    for (const fn of this.cleanupFns) fn();
    this.cleanupFns = [];
    this.root?.remove();
    this.root = null;
  }

  toggle(): void {
    this.isOpen = !this.isOpen;
    this.root?.classList.toggle(`${CSS_PREFIX}open`, this.isOpen);
    if (!this.isOpen) {
      this.closeThreadDrawer();
    }
  }

  open(): void {
    this.isOpen = true;
    this.root?.classList.add(`${CSS_PREFIX}open`);
  }

  close(): void {
    this.isOpen = false;
    this.root?.classList.remove(`${CSS_PREFIX}open`);
    this.closeThreadDrawer();
  }

  // ── DOM Construction ───────────────────────────────────────

  private buildDOM(): HTMLDivElement {
    const panel = document.createElement('div');
    panel.className = `${CSS_PREFIX}panel`;

    // Stop all keyboard events from bubbling out of the chat panel.
    // The game's Mousetrap binds z/n/Enter on document to advance passages,
    // and its stopCallback override ignores form elements.  Stopping
    // propagation here prevents every keystroke inside the panel from
    // accidentally triggering game shortcuts.
    for (const evtName of ['keydown', 'keypress', 'keyup'] as const) {
      panel.addEventListener(evtName, (e) => e.stopPropagation());
    }

    panel.appendChild(this.buildHeader());

    this.bodyEl = document.createElement('div');
    this.bodyEl.className = `${CSS_PREFIX}body`;

    const threadUi = this.buildThreadDrawer();
    this.threadBackdrop = threadUi.backdrop;
    this.threadDrawer = threadUi.drawer;
    this.threadListEl = threadUi.list;

    this.messagesEl = document.createElement('div');
    this.messagesEl.className = `${CSS_PREFIX}messages`;

    this.bodyEl.appendChild(this.threadBackdrop);
    this.bodyEl.appendChild(this.threadDrawer);
    this.bodyEl.appendChild(this.messagesEl);
    panel.appendChild(this.bodyEl);

    this.inputArea = this.buildInputArea();
    panel.appendChild(this.inputArea);

    return panel;
  }

  private buildHeader(): HTMLDivElement {
    const header = document.createElement('div');
    header.className = `${CSS_PREFIX}header`;

    const left = document.createElement('div');
    left.className = `${CSS_PREFIX}header-left`;

    const menuBtn = document.createElement('button');
    menuBtn.className = `${CSS_PREFIX}header-btn`;
    menuBtn.type = 'button';
    menuBtn.textContent = '☰';
    menuBtn.title = t('ui.thread_label');
    menuBtn.setAttribute('aria-label', t('ui.thread_label'));
    menuBtn.addEventListener('click', () => this.toggleThreadDrawer());

    const title = document.createElement('span');
    title.className = `${CSS_PREFIX}header-title`;
    title.textContent = t('ui.title');

    left.appendChild(menuBtn);
    left.appendChild(title);

    this.statusBtn = document.createElement('button');
    this.statusBtn.className = `${CSS_PREFIX}status-icon-btn ${CSS_PREFIX}unknown`;
    this.statusBtn.type = 'button';
    this.statusBtn.textContent = '●';
    this.statusBtn.title = t('status.unknown_short');
    this.statusBtn.setAttribute('aria-label', t('status.unknown_short'));
    this.statusBtn.addEventListener('click', () => {
      void this.runNetworkCheck();
    });
    left.appendChild(this.statusBtn);

    const actions = document.createElement('div');
    actions.className = `${CSS_PREFIX}header-actions`;

    const settingsBtn = this.createHeaderBtn(t('ui.settings'), () => {
      this.openGameSettings();
    });
    settingsBtn.appendChild(this.createUiIcon('img/ui/options.png'));

    const closeBtn = this.createHeaderBtn(t('ui.close'), () => this.close());
    closeBtn.textContent = '✕';

    actions.appendChild(settingsBtn);
    actions.appendChild(closeBtn);

    header.appendChild(left);
    header.appendChild(actions);
    return header;
  }

  private buildThreadDrawer(): {
    backdrop: HTMLDivElement;
    drawer: HTMLDivElement;
    list: HTMLDivElement;
  } {
    const backdrop = document.createElement('div');
    backdrop.className = `${CSS_PREFIX}thread-backdrop`;
    backdrop.addEventListener('click', () => this.closeThreadDrawer());

    const drawer = document.createElement('div');
    drawer.className = `${CSS_PREFIX}thread-drawer`;

    const toolbar = document.createElement('div');
    toolbar.className = `${CSS_PREFIX}thread-toolbar`;

    const title = document.createElement('span');
    title.className = `${CSS_PREFIX}thread-title`;
    title.textContent = t('ui.thread_label');

    const addBtn = document.createElement('button');
    addBtn.className = `${CSS_PREFIX}thread-add-btn`;
    addBtn.type = 'button';
    addBtn.title = t('msg.new_chat');
    addBtn.setAttribute('aria-label', t('msg.new_chat'));
    addBtn.appendChild(this.createFaIcon('fa-plus'));
    addBtn.addEventListener('click', () => {
      void this.handleNewChat();
    });

    toolbar.appendChild(title);
    toolbar.appendChild(addBtn);

    const list = document.createElement('div');
    list.className = `${CSS_PREFIX}thread-list`;

    drawer.appendChild(toolbar);
    drawer.appendChild(list);

    return { backdrop, drawer, list };
  }

  private createHeaderBtn(tooltip: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = `${CSS_PREFIX}header-btn`;
    btn.type = 'button';
    btn.title = tooltip;
    btn.setAttribute('aria-label', tooltip);
    btn.addEventListener('click', onClick);
    return btn;
  }

  private createFaIcon(iconClass: string): HTMLSpanElement {
    const icon = document.createElement('span');
    icon.className = `${CSS_PREFIX}btn-icon fa-icon ${iconClass}`;
    icon.setAttribute('aria-hidden', 'true');
    return icon;
  }

  private createUiIcon(src: string): HTMLImageElement {
    const icon = document.createElement('img');
    icon.className = `${CSS_PREFIX}btn-icon-img`;
    icon.src = src;
    icon.alt = '';
    icon.setAttribute('aria-hidden', 'true');
    return icon;
  }

  private buildInputArea(): HTMLDivElement {
    const area = document.createElement('div');
    area.className = `${CSS_PREFIX}input-area`;

    this.inputEl = document.createElement('textarea');
    this.inputEl.className = `${CSS_PREFIX}input`;
    this.inputEl.placeholder = t('ui.input_placeholder');
    this.inputEl.rows = 1;
    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        void this.handleSend();
      }
    });

    this.sendBtn = document.createElement('button');
    this.sendBtn.className = `${CSS_PREFIX}send-btn`;
    this.sendBtn.type = 'button';
    this.sendBtn.textContent = '▶';
    this.sendBtn.title = t('ui.send');
    this.sendBtn.setAttribute('aria-label', t('ui.send'));
    this.sendBtn.addEventListener('click', () => {
      void this.handleSend();
    });

    area.appendChild(this.inputEl);
    area.appendChild(this.sendBtn);
    return area;
  }

  // ── Drawer Controls ────────────────────────────────────────

  private toggleThreadDrawer(): void {
    if (this.isThreadDrawerOpen) {
      this.closeThreadDrawer();
    } else {
      this.openThreadDrawer();
    }
  }

  private openThreadDrawer(): void {
    this.isThreadDrawerOpen = true;
    this.threadBackdrop.classList.add(`${CSS_PREFIX}open`);
    this.threadDrawer.classList.add(`${CSS_PREFIX}open`);
  }

  private closeThreadDrawer(): void {
    this.isThreadDrawerOpen = false;
    if (!this.threadBackdrop || !this.threadDrawer) return;
    this.threadBackdrop.classList.remove(`${CSS_PREFIX}open`);
    this.threadDrawer.classList.remove(`${CSS_PREFIX}open`);
  }

  // ── Open Game Settings ─────────────────────────────────────

  /**
   * Show a hint telling the user where to find settings.
   * We intentionally don't auto-navigate to the Options overlay because
   * programmatic macro evaluation can conflict with SugarCube state.
   */
  private openGameSettings(): void {
    this.addSystemMessage(t('settings.open_hint'));
  }

  // ── Network Status ─────────────────────────────────────────

  private async runNetworkCheck(): Promise<void> {
    const settings = this.runtime.settings.get();
    this.setStatusDisplay(NetworkStatus.UNKNOWN, t('status.checking'));
    const result = await this.runtime.network.check(settings.apiUrl, settings.apiKey);
    this.setStatusDisplay(result.status, result.message, result.detail);
  }

  private refreshStatus(): void {
    const result = this.runtime.network.getLastResult();
    this.setStatusDisplay(result.status, result.message, result.detail);
  }

  private setStatusDisplay(status: NetworkStatus, message: string, detail?: string): void {
    if (!this.statusBtn) return;

    let modifier: string;
    switch (status) {
      case NetworkStatus.OK:
        modifier = 'ok';
        break;
      case NetworkStatus.NOT_CONFIGURED:
      case NetworkStatus.UNKNOWN:
        modifier = 'unknown';
        break;
      case NetworkStatus.API_AUTH_ERROR:
        modifier = 'warn';
        break;
      default:
        modifier = 'error';
    }

    this.statusBtn.className = `${CSS_PREFIX}status-icon-btn ${CSS_PREFIX}${modifier}`;
    this.statusBtn.title = detail ? `${message}\n${detail}` : message;
    this.statusBtn.setAttribute('aria-label', message);
  }

  // ── Thread List ────────────────────────────────────────────

  private refreshThreadList(): void {
    if (!this.threadListEl) return;

    const threads = this.runtime.conversation.getThreads();
    const activeId = this.runtime.conversation.getActiveThreadId();

    this.threadListEl.innerHTML = '';

    if (threads.length === 0) {
      const empty = document.createElement('div');
      empty.className = `${CSS_PREFIX}thread-empty`;
      empty.textContent = t('ui.thread_empty');
      this.threadListEl.appendChild(empty);
      return;
    }

    for (let i = 0; i < threads.length; i += 1) {
      const thread = threads[i];
      const row = document.createElement('div');
      row.className = `${CSS_PREFIX}thread-item`;
      if (thread.threadId === activeId) {
        row.classList.add(`${CSS_PREFIX}active`);
      }

      const openBtn = document.createElement('button');
      openBtn.className = `${CSS_PREFIX}thread-open-btn`;
      openBtn.type = 'button';
      openBtn.textContent = this.formatThreadLabel(thread, i);
      openBtn.title = this.formatThreadLabel(thread, i);
      openBtn.addEventListener('click', () => {
        void this.handleThreadSwitch(thread.threadId);
      });

      const delBtn = document.createElement('button');
      delBtn.className = `${CSS_PREFIX}thread-delete-btn`;
      delBtn.type = 'button';
      delBtn.title = t('ui.thread_delete');
      delBtn.setAttribute('aria-label', t('ui.thread_delete'));
      delBtn.appendChild(this.createFaIcon('fa-trash'));
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        void this.handleDeleteThread(thread.threadId);
      });

      row.appendChild(openBtn);
      row.appendChild(delBtn);
      this.threadListEl.appendChild(row);
    }
  }

  private formatThreadLabel(thread: ThreadMeta, index: number): string {
    const fallback = `${t('ui.thread_fallback')} ${index + 1}`;
    const title = thread.title?.trim() || fallback;
    return title.length > 36 ? `${title.slice(0, 36)}...` : title;
  }

  private async handleThreadSwitch(threadId: string): Promise<void> {
    if (!threadId) return;
    if (threadId === this.runtime.conversation.getActiveThreadId()) {
      this.closeThreadDrawer();
      return;
    }

    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    this.liveAssistant = null;
    this.setSending(false);

    await this.runtime.conversation.switchThread(threadId);
    this.refreshThreadList();
    this.renderConversation();
    this.closeThreadDrawer();
  }

  private async handleDeleteThread(threadId: string): Promise<void> {
    if (this.isSending) return;

    await this.runtime.conversation.deleteThread(threadId);
    this.refreshThreadList();
    this.renderConversation();
  }

  // ── Messages Rendering ─────────────────────────────────────

  private addSystemMessage(text: string): void {
    this.clearEmptyHint();
    const msg = document.createElement('div');
    msg.className = `${CSS_PREFIX}msg ${CSS_PREFIX}msg-system`;
    msg.textContent = text;
    this.messagesEl.appendChild(msg);
    this.scrollToBottom();
  }

  private addUserMessage(text: string): void {
    this.clearEmptyHint();
    const msg = document.createElement('div');
    msg.className = `${CSS_PREFIX}msg ${CSS_PREFIX}msg-user`;
    msg.textContent = text;
    this.messagesEl.appendChild(msg);
    this.scrollToBottom();
  }

  private createAssistantDom(isStreaming: boolean): AssistantDom {
    this.clearEmptyHint();

    const root = document.createElement('div');
    root.className = `${CSS_PREFIX}msg ${CSS_PREFIX}msg-assistant`;
    if (isStreaming) {
      root.classList.add(`${CSS_PREFIX}msg-streaming`);
    }

    const reasoningWrap = document.createElement('div');
    reasoningWrap.className = `${CSS_PREFIX}reasoning`;
    reasoningWrap.style.display = 'none';

    const reasoningTitle = document.createElement('div');
    reasoningTitle.className = `${CSS_PREFIX}section-title`;
    reasoningTitle.textContent = t('ui.reasoning');

    const reasoningText = document.createElement('pre');
    reasoningText.className = `${CSS_PREFIX}reasoning-text`;

    reasoningWrap.appendChild(reasoningTitle);
    reasoningWrap.appendChild(reasoningText);

    const toolsWrap = document.createElement('div');
    toolsWrap.className = `${CSS_PREFIX}tools`;

    const textEl = document.createElement('div');
    textEl.className = `${CSS_PREFIX}assistant-text`;
    textEl.textContent = isStreaming ? t('agent.thinking_with_tools') : '';

    root.appendChild(reasoningWrap);
    root.appendChild(toolsWrap);
    root.appendChild(textEl);
    this.messagesEl.appendChild(root);
    this.scrollToBottom();

    return {
      root,
      reasoningWrap,
      reasoningText,
      toolsWrap,
      textEl,
    };
  }

  private createToolCardDetails(part: ToolCardView, expand = false): HTMLDetailsElement {
    const details = document.createElement('details');
    details.className = `${CSS_PREFIX}tool-entry`;
    if (expand) {
      details.open = true;
    }

    if (part.status === 'success') {
      details.classList.add(`${CSS_PREFIX}tool-result-entry`);
    } else if (part.status === 'error' || part.status === 'denied') {
      details.classList.add(`${CSS_PREFIX}tool-result-entry`);
      details.classList.add(`${CSS_PREFIX}tool-result-error`);
    } else {
      details.classList.add(`${CSS_PREFIX}tool-call-entry`);
    }

    const summary = document.createElement('summary');
    if (part.status === 'success') {
      summary.textContent = t('agent.tool_result', { tool: part.tool });
    } else if (part.status === 'error' || part.status === 'denied') {
      summary.textContent = t('agent.tool_error', { tool: part.tool, error: part.error ?? 'error' });
    } else {
      summary.textContent = t('agent.tool_call', { tool: part.tool });
    }

    const content = document.createElement('pre');
    content.className = `${CSS_PREFIX}tool-content`;
    const payload: Record<string, unknown> = {};
    if (part.input !== undefined) {
      payload.input = part.input;
    }
    if (part.status === 'success') {
      payload.output = part.output ?? null;
    } else if (part.status === 'error' || part.status === 'denied') {
      payload.error = part.error ?? 'Unknown tool error';
    }
    content.textContent = this.prettyJson(payload);

    details.appendChild(summary);
    details.appendChild(content);
    return details;
  }

  private renderConversation(): void {
    this.messagesEl.innerHTML = '';

    const messages = this.runtime.conversation.getMessages();
    const visible = messages.filter((msg) => msg.role !== 'system');
    if (visible.length === 0) {
      this.showEmptyHint();
      return;
    }

    for (const msg of visible) {
      this.renderStoredMessage(msg);
    }
    this.scrollToBottom();
  }

  private renderStoredMessage(msg: UIMessage): void {
    if (msg.role === 'user') {
      const text = (msg.parts as any[])
        .filter((part) => part?.type === 'text' && typeof part.text === 'string')
        .map((part) => part.text)
        .join('\n')
        .trim();
      if (text) this.addUserMessage(text);
      return;
    }

    if (msg.role !== 'assistant') return;

    const dom = this.createAssistantDom(false);
    let assistantText = '';

    for (const part of msg.parts as any[]) {
      if (part?.type === 'text' && typeof part.text === 'string') {
        assistantText += part.text;
        continue;
      }
      this.renderAssistantPart(dom, part);
    }

    if (assistantText.trim()) {
      dom.textEl.innerHTML = renderMarkdown(assistantText);
    } else {
      dom.textEl.textContent = '';
    }
  }

  private renderAssistantPart(dom: AssistantDom, part: any): void {
    if (part?.type === 'reasoning' && typeof part.text === 'string') {
      dom.reasoningWrap.style.display = '';
      dom.reasoningText.textContent += part.text;
      return;
    }
    const toolName = this.extractToolName(part);
    if (toolName) {
      const state = part.state as string | undefined;
      const callId = part.toolCallId || this.generateFallbackCallId(toolName);

      if (
        state === 'input-streaming'
        || state === 'input-available'
        || state === 'approval-requested'
        || state === 'approval-responded'
      ) {
        const status: ToolCardStatus = (state === 'approval-requested' || state === 'approval-responded')
          ? 'approval'
          : 'input';
        dom.toolsWrap.appendChild(this.createToolCardDetails({
          tool: toolName,
          callId,
          status,
          input: part.input ?? null,
        }));
        return;
      }

      if (state === 'output-available') {
        dom.toolsWrap.appendChild(this.createToolCardDetails({
          tool: toolName,
          callId,
          status: 'success',
          input: part.input ?? null,
          output: part.output,
        }));
        return;
      }

      if (state === 'output-error') {
        dom.toolsWrap.appendChild(this.createToolCardDetails({
          tool: toolName,
          callId,
          status: 'error',
          input: part.input ?? null,
          error: part.errorText || 'Unknown tool error',
        }));
        return;
      }

      if (state === 'output-denied') {
        dom.toolsWrap.appendChild(this.createToolCardDetails({
          tool: toolName,
          callId,
          status: 'denied',
          input: part.input ?? null,
          error: part.approval?.reason || 'Tool output denied',
        }));
      }
      return;
    }
  }

  private clearEmptyHint(): void {
    const empty = this.messagesEl.querySelector(`.${CSS_PREFIX}empty`);
    empty?.remove();
  }

  private showEmptyHint(): void {
    const hint = this.runtime.settings.isConfigured()
      ? t('ui.empty_hint_configured')
      : t('ui.empty_hint');
    this.messagesEl.innerHTML = `<div class="${CSS_PREFIX}empty">${hint.replace('\n', '<br>')}</div>`;
  }

  private scrollToBottom(): void {
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  // ── Thread / New Chat ──────────────────────────────────────

  private async handleNewChat(): Promise<void> {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    this.liveAssistant = null;
    this.setSending(false);

    await this.runtime.conversation.createThread();
    this.refreshThreadList();
    this.renderConversation();
    this.closeThreadDrawer();
  }

  // ── Input Handling ─────────────────────────────────────────

  private async handleSend(): Promise<void> {
    if (this.isSending) return;

    const text = this.inputEl.value.trim();
    if (!text) return;

    if (!this.runtime.settings.isConfigured()) {
      this.addSystemMessage(t('msg.not_configured'));
      return;
    }

    this.addUserMessage(text);
    this.inputEl.value = '';

    await this.runtime.conversation.addUserTextMessage(text);
    this.refreshThreadList();

    const settings = this.runtime.settings.get();
    const saveConfig = this.runtime.saveConfig.get();
    const systemPrompt = saveConfig.systemPrompt || DEFAULT_SYSTEM_PROMPT;
    const assistantDom = this.createAssistantDom(true);
    this.liveAssistant = {
      ...assistantDom,
      textBuffer: '',
      reasoningBuffer: '',
      callIdByTool: new Map<string, string>(),
      inputByCallId: new Map<string, unknown>(),
      toolCardByCallId: new Map<string, HTMLDetailsElement>(),
      streamThrottle: new StreamThrottle(assistantDom.textEl),
    };

    this.setSending(true);
    this.abortController = new AbortController();

    try {
      const result = await this.runtime.agent.run({
        messages: [...this.runtime.conversation.getMessages()],
        systemPrompt,
        settings,
        maxSteps: saveConfig.maxSteps,
        temperature: saveConfig.assistantTemperature,
        signal: this.abortController.signal,
        callbacks: {
          onToken: (token) => {
            this.appendAssistantToken(token);
          },
          onReasoningToken: (token) => {
            this.appendReasoningToken(token);
          },
          onToolCall: (info: ToolCallInfo) => {
            this.handleToolCall(info);
          },
          onToolResult: (info: ToolResultInfo) => {
            this.handleToolResult(info);
          },
          onStepComplete: (info: StepInfo) => {
            logger.info(
              `Step ${info.stepNumber}: reason=${info.finishReason}, tools=${info.toolCalls.length}`,
            );
          },
        },
      });

      const finalText = result.text.trim();
      await this.runtime.conversation.replaceMessages(result.messages);
      if (!finalText) {
        const emptyText = t('msg.empty_response');
        this.completeLiveAssistant(emptyText, false);
      } else {
        this.completeLiveAssistant(result.text, false);
      }

    } catch (err) {
      const llmError = err instanceof LLMError
        ? err
        : new LLMError(LLMErrorType.UNKNOWN, (err as Error).message || String(err));

      const errorText = llmError.message || t('llm.unknown_error');
      this.completeLiveAssistant(errorText, true);
      await this.runtime.conversation.addAssistantTextMessage(errorText);
      logger.warn('LLM error:', llmError.type, llmError.message);
    } finally {
      this.setSending(false);
      this.abortController = null;
      this.liveAssistant = null;
      this.refreshThreadList();
      this.renderConversation();
    }
  }

  private appendAssistantToken(token: string): void {
    if (!this.liveAssistant) return;
    this.liveAssistant.textBuffer += token;
    // Phase 1: plain textContent, RAF-throttled to avoid high-frequency reflows
    this.liveAssistant.streamThrottle.update(this.liveAssistant.textBuffer);
    this.scrollToBottom();
  }

  private appendReasoningToken(token: string): void {
    if (!this.liveAssistant) return;
    this.liveAssistant.reasoningBuffer += token;
    this.liveAssistant.reasoningWrap.style.display = '';
    this.liveAssistant.reasoningText.textContent = this.liveAssistant.reasoningBuffer;
    this.scrollToBottom();
  }

  private handleToolCall(info: ToolCallInfo): void {
    if (!this.liveAssistant) return;

    const callId = info.callId || this.generateFallbackCallId(info.toolName);
    this.liveAssistant.callIdByTool.set(info.toolName, callId);
    this.liveAssistant.inputByCallId.set(callId, info.args ?? null);

    const part: ToolCardView = {
      tool: info.toolName,
      callId,
      status: 'input',
      input: info.args ?? null,
    };
    this.upsertLiveToolCard(part);
    this.scrollToBottom();
  }

  private handleToolResult(info: ToolResultInfo): void {
    if (!this.liveAssistant) return;

    const callId = info.callId
      || this.liveAssistant.callIdByTool.get(info.toolName)
      || this.generateFallbackCallId(info.toolName);
    const input = this.liveAssistant.inputByCallId.get(callId);
    const part: ToolCardView = info.ok
      ? {
        tool: info.toolName,
        callId,
        status: 'success',
        input,
        output: info.result,
      }
      : {
        tool: info.toolName,
        callId,
        status: 'error',
        input,
        error: info.errorText || String(info.result),
      };
    this.upsertLiveToolCard(part);
    this.scrollToBottom();
  }

  private completeLiveAssistant(text: string, isError: boolean): void {
    if (!this.liveAssistant) return;

    // Cancel any pending streaming RAF before switching to innerHTML
    this.liveAssistant.streamThrottle.cancel();

    this.liveAssistant.root.classList.remove(`${CSS_PREFIX}msg-streaming`);
    if (isError) {
      // Error text shown as plain text, no markdown
      this.liveAssistant.textEl.textContent = text;
      this.liveAssistant.root.classList.add(`${CSS_PREFIX}msg-error`);
    } else {
      // Phase 2: full markdown render + XSS sanitize
      this.liveAssistant.textEl.innerHTML = renderMarkdown(text);
    }
  }

  /**
   * Toggle the sending state — disables input during generation.
   */
  private setSending(sending: boolean): void {
    this.isSending = sending;
    if (this.sendBtn) {
      this.sendBtn.disabled = sending;
      this.sendBtn.textContent = sending ? '⏳' : '▶';
    }
    if (this.inputEl) {
      this.inputEl.disabled = sending;
    }
  }

  // ── Formatting Helpers ─────────────────────────────────────

  private prettyJson(value: unknown): string {
    try {
      return nativeStringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  private upsertLiveToolCard(part: ToolCardView): void {
    if (!this.liveAssistant) return;
    const existing = this.liveAssistant.toolCardByCallId.get(part.callId);
    const next = this.createToolCardDetails(part, true);
    if (existing && existing.parentElement === this.liveAssistant.toolsWrap) {
      this.liveAssistant.toolsWrap.replaceChild(next, existing);
    } else {
      this.liveAssistant.toolsWrap.appendChild(next);
    }
    this.liveAssistant.toolCardByCallId.set(part.callId, next);
  }

  private generateFallbackCallId(toolName: string): string {
    this.callFallbackCounter += 1;
    return `call_${toolName}_${Date.now()}_${this.callFallbackCounter}`;
  }

  private extractToolName(part: any): string | null {
    if (!part || typeof part !== 'object') return null;
    if (typeof part.type === 'string' && part.type.startsWith('tool-')) {
      return part.type.slice('tool-'.length);
    }
    if (part.type === 'dynamic-tool' && typeof part.toolName === 'string') {
      return part.toolName;
    }
    return null;
  }
}
