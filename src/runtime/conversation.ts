/**
 * Conversation manager — multi-thread persistence based on AI SDK UIMessage.
 *
 * Storage keys:
 * - `chat.schemaVersion` -> number
 * - `chat.activeThreadId` -> string
 * - `chat.threadIds` -> string[]
 * - `chat.thread.{threadId}.meta` -> ThreadMeta
 * - `chat.thread.{threadId}.messages` -> UIMessage[]
 */
import type { UIMessage } from 'ai';
import { Logger } from '../utils/logger.js';
import { idbDelete, idbGet, idbKeys, idbSet, initIDB } from '../utils/idb.js';
import { IDB_MEMORY_STORE } from '../utils/constants.js';
import { EventBus } from '../utils/events.js';
import { nativeParse, nativeStringify } from '../utils/safe-json.js';

const logger = new Logger('Conversation');

const CHAT_SCHEMA_VERSION = 2;
const KEY_SCHEMA_VERSION = 'chat.schemaVersion';
const KEY_ACTIVE_THREAD_ID = 'chat.activeThreadId';
const KEY_THREAD_IDS = 'chat.threadIds';
const THREAD_PREFIX = 'chat.thread.';

export type ThreadMeta = {
  threadId: string;
  title?: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
};

export type ConversationEventMap = {
  'messages-changed': [UIMessage[]];
  'thread-changed': [ThreadMeta];
  'threads-changed': [ThreadMeta[]];
};

export class ConversationManager {
  private activeThread: ThreadMeta | null = null;
  private threads: ThreadMeta[] = [];
  private messages: UIMessage[] = [];
  private writeQueue: Promise<void> = Promise.resolve();
  readonly events = new EventBus<ConversationEventMap>();

  // ── Queries ──────────────────────────────────────────────

  getMessages(): ReadonlyArray<UIMessage> {
    return this.messages;
  }

  getThreads(): ReadonlyArray<ThreadMeta> {
    return this.threads;
  }

  getActiveThreadId(): string {
    return this.activeThread?.threadId ?? '';
  }

  // ── Lifecycle ────────────────────────────────────────────

  async load(): Promise<void> {
    try {
      await initIDB();
      await this.ensureSchema();

      const threadIds = await this.loadThreadIds();
      const threadMetas = await Promise.all(
        threadIds.map((id) => idbGet<ThreadMeta>(IDB_MEMORY_STORE, this.threadMetaKey(id))),
      );

      this.threads = threadMetas
        .filter((meta): meta is ThreadMeta => !!meta && this.isValidThreadMeta(meta))
        .sort((a, b) => b.updatedAt - a.updatedAt);

      if (this.threads.length === 0) {
        await this.createThread();
        logger.info('No persisted thread found; created default thread');
        return;
      }

      const persistedActiveId = await idbGet<string>(IDB_MEMORY_STORE, KEY_ACTIVE_THREAD_ID);
      const targetId = this.threads.some((t) => t.threadId === persistedActiveId)
        ? (persistedActiveId as string)
        : this.threads[0].threadId;

      await this.switchThread(targetId);
      logger.info(`Conversation restored (${this.messages.length} messages)`);
    } catch (e) {
      logger.error('Failed to load conversation:', e);
      await this.createThread();
    }
  }

  // ── Thread Operations ────────────────────────────────────

  async clear(): Promise<void> {
    await this.createThread();
  }

  async createThread(title?: string): Promise<ThreadMeta> {
    return this.enqueueWrite(async () => this.createThreadInternal(title));
  }

  async switchThread(threadId: string): Promise<void> {
    await this.enqueueWrite(async () => {
      const meta = this.threads.find((item) => item.threadId === threadId);
      if (!meta) {
        logger.warn(`switchThread ignored; unknown thread: ${threadId}`);
        return;
      }

      const messages = await this.loadMessagesForThread(meta);
      this.activeThread = meta;
      this.messages = messages;
      await idbSet(IDB_MEMORY_STORE, KEY_ACTIVE_THREAD_ID, meta.threadId);
      this.emitThreadEvents(meta);
      this.emitMessagesChanged();
    });
  }

  async deleteThread(threadId: string): Promise<void> {
    await this.enqueueWrite(async () => {
      const index = this.threads.findIndex((item) => item.threadId === threadId);
      if (index < 0) return;

      const removed = this.threads[index];
      await Promise.all([
        idbDelete(IDB_MEMORY_STORE, this.threadMetaKey(removed.threadId)),
        idbDelete(IDB_MEMORY_STORE, this.threadMessagesKey(removed.threadId)),
      ]);

      this.threads.splice(index, 1);
      await this.persistThreadIds();

      const activeWasDeleted = this.activeThread?.threadId === removed.threadId;
      if (!activeWasDeleted) {
        if (this.activeThread) {
          this.emitThreadEvents(this.activeThread);
        }
        return;
      }

      if (this.threads.length === 0) {
        await this.createThreadInternal();
        return;
      }

      this.sortThreads();
      const nextActive = this.threads[0];
      this.activeThread = nextActive;
      this.messages = await this.loadMessagesForThread(nextActive);
      await idbSet(IDB_MEMORY_STORE, KEY_ACTIVE_THREAD_ID, nextActive.threadId);
      this.emitThreadEvents(nextActive);
      this.emitMessagesChanged();
    });
  }

  // ── Message Mutations ────────────────────────────────────

  async addUserTextMessage(text: string): Promise<UIMessage> {
    return this.enqueueWrite(async () => {
      const created = this.createTextMessage('user', text.trim());
      this.messages = [...this.messages, created];
      await this.persistActiveThreadMessages(true);
      return created;
    });
  }

  async addSystemTextMessage(text: string): Promise<UIMessage> {
    return this.enqueueWrite(async () => {
      const created = this.createTextMessage('system', text);
      this.messages = [...this.messages, created];
      await this.persistActiveThreadMessages(false);
      return created;
    });
  }

  async addAssistantTextMessage(text: string): Promise<UIMessage> {
    return this.enqueueWrite(async () => {
      const created = this.createTextMessage('assistant', text);
      this.messages = [...this.messages, created];
      await this.persistActiveThreadMessages(false);
      return created;
    });
  }

  async replaceMessages(messages: UIMessage[]): Promise<void> {
    await this.enqueueWrite(async () => {
      this.messages = this.cloneMessages(messages);
      await this.persistActiveThreadMessages(true);
    });
  }

  // ── Internals: Persistence ───────────────────────────────

  private async loadMessagesForThread(meta: ThreadMeta): Promise<UIMessage[]> {
    const raw = await idbGet<unknown>(IDB_MEMORY_STORE, this.threadMessagesKey(meta.threadId));
    if (!Array.isArray(raw)) return [];
    return this.sanitizeMessages(raw);
  }

  private async persistThreadMeta(meta: ThreadMeta): Promise<void> {
    await idbSet(IDB_MEMORY_STORE, this.threadMetaKey(meta.threadId), meta);
  }

  private async persistThreadIds(): Promise<void> {
    const ids = this.threads.map((item) => item.threadId);
    await idbSet(IDB_MEMORY_STORE, KEY_THREAD_IDS, ids);
  }

  private async loadThreadIds(): Promise<string[]> {
    const ids = await idbGet<string[]>(IDB_MEMORY_STORE, KEY_THREAD_IDS);
    return Array.isArray(ids) ? ids : [];
  }

  private async createThreadInternal(title?: string): Promise<ThreadMeta> {
    const now = Date.now();
    const meta: ThreadMeta = {
      threadId: this.generateThreadId(),
      title,
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
    };

    this.threads.push(meta);
    this.sortThreads();
    await this.persistThreadMeta(meta);
    await this.persistThreadIds();
    await idbSet(IDB_MEMORY_STORE, this.threadMessagesKey(meta.threadId), []);
    await idbSet(IDB_MEMORY_STORE, KEY_ACTIVE_THREAD_ID, meta.threadId);

    this.activeThread = meta;
    this.messages = [];
    this.emitThreadEvents(meta);
    this.emitMessagesChanged();
    return meta;
  }

  private async persistActiveThreadMessages(updateTitleFromFirstUser: boolean): Promise<void> {
    const thread = this.requireActiveThread();
    thread.messageCount = this.messages.length;
    thread.updatedAt = Date.now();

    if (updateTitleFromFirstUser && !thread.title?.trim()) {
      const firstUserText = this.extractFirstUserText(this.messages);
      if (firstUserText) {
        thread.title = firstUserText.slice(0, 30);
      }
    }

    this.sortThreads();
    await idbSet(
      IDB_MEMORY_STORE,
      this.threadMessagesKey(thread.threadId),
      this.cloneMessages(this.messages),
    );
    await this.persistThreadMeta(thread);

    this.emitThreadEvents(thread);
    this.emitMessagesChanged();
  }

  // ── Internals: Schema ────────────────────────────────────

  private async ensureSchema(): Promise<void> {
    const current = await idbGet<number>(IDB_MEMORY_STORE, KEY_SCHEMA_VERSION);
    if (current === CHAT_SCHEMA_VERSION) return;

    const allKeys = await idbKeys(IDB_MEMORY_STORE);
    const chatKeys = allKeys.filter((key) => key.startsWith('chat.'));
    await Promise.all(chatKeys.map((key) => idbDelete(IDB_MEMORY_STORE, key)));
    await idbSet(IDB_MEMORY_STORE, KEY_SCHEMA_VERSION, CHAT_SCHEMA_VERSION);

    logger.info(`Conversation schema upgraded to v${CHAT_SCHEMA_VERSION}; old chat data cleared`);
  }

  // ── Internals: Utilities ────────────────────────────────

  private enqueueWrite<T>(op: () => Promise<T>): Promise<T> {
    const next = this.writeQueue.then(op, op);
    this.writeQueue = next.then(() => undefined, () => undefined);
    return next;
  }

  private requireActiveThread(): ThreadMeta {
    if (!this.activeThread) {
      throw new Error('No active thread. Call load() first.');
    }
    return this.activeThread;
  }

  private emitMessagesChanged(): void {
    this.events.emit('messages-changed', this.cloneMessages(this.messages));
  }

  private emitThreadEvents(active: ThreadMeta): void {
    this.events.emit('thread-changed', { ...active });
    this.events.emit('threads-changed', this.threads.map((item) => ({ ...item })));
  }

  private sortThreads(): void {
    this.threads.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  private createTextMessage(role: 'system' | 'user' | 'assistant', text: string): UIMessage {
    return {
      id: this.generateMessageId(),
      role,
      parts: [{ type: 'text', text }],
    };
  }

  private sanitizeMessages(raw: unknown): UIMessage[] {
    if (!Array.isArray(raw)) return [];

    const sanitized: UIMessage[] = [];
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;
      const msg = item as any;
      if (msg.role !== 'system' && msg.role !== 'user' && msg.role !== 'assistant') continue;
      if (!Array.isArray(msg.parts)) continue;

      let cloned: any;
      try {
        cloned = nativeParse(nativeStringify(msg));
      } catch {
        cloned = { ...msg };
      }
      if (typeof cloned.id !== 'string') {
        cloned.id = this.generateMessageId();
      }
      sanitized.push(cloned as UIMessage);
    }

    return sanitized;
  }

  private extractFirstUserText(messages: ReadonlyArray<UIMessage>): string {
    for (const message of messages) {
      if (message.role !== 'user' || !Array.isArray(message.parts)) continue;
      for (const part of message.parts as any[]) {
        if (part?.type === 'text' && typeof part.text === 'string' && part.text.trim()) {
          return part.text.trim();
        }
      }
    }
    return '';
  }

  private cloneMessages(messages: ReadonlyArray<UIMessage>): UIMessage[] {
    try {
      return nativeParse(nativeStringify(messages)) as UIMessage[];
    } catch {
      return messages.map((message) => ({ ...message }));
    }
  }

  private isValidThreadMeta(meta: ThreadMeta): boolean {
    return (
      typeof meta.threadId === 'string'
      && typeof meta.createdAt === 'number'
      && typeof meta.updatedAt === 'number'
      && typeof meta.messageCount === 'number'
    );
  }

  private threadMetaKey(threadId: string): string {
    return `${THREAD_PREFIX}${threadId}.meta`;
  }

  private threadMessagesKey(threadId: string): string {
    return `${THREAD_PREFIX}${threadId}.messages`;
  }

  private generateThreadId(): string {
    return `thread_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
}
