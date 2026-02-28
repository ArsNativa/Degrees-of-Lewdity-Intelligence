/**
 * LLM client — wraps Vercel AI SDK for OpenAI-compatible API calls.
 *
 * Provides streaming chat, timeout handling, and error classification.
 * The underlying provider is recreated on each call to reflect the
 * latest user-configured API URL / key / model.
 */
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { streamText, generateText, type ModelMessage } from 'ai';
import { Logger } from '../utils/logger.js';
import type { BrowserSettings } from '../utils/settings/index.js';
import { t } from '../utils/i18n/index.js';
import { safeFetch } from '../utils/safe-json.js';

const logger = new Logger('LLM');

// ── Error types ─────────────────────────────────────────────

export enum LLMErrorType {
  NOT_CONFIGURED = 'not_configured',
  AUTH_ERROR = 'auth_error',
  RATE_LIMIT = 'rate_limit',
  NETWORK_ERROR = 'network_error',
  TIMEOUT = 'timeout',
  MODEL_ERROR = 'model_error',
  CONTENT_FILTER = 'content_filter',
  UNKNOWN = 'unknown',
}

export class LLMError extends Error {
  readonly type: LLMErrorType;
  readonly detail?: string;

  constructor(type: LLMErrorType, message: string, detail?: string) {
    super(message);
    this.name = 'LLMError';
    this.type = type;
    this.detail = detail;
  }
}

// ── Public types ────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface LLMStreamCallbacks {
  /** Called for each text token as it arrives. */
  onToken?: (token: string) => void;
  /** Called once when the full response is available. */
  onComplete?: (fullText: string) => void;
  /** Called if an error occurs during streaming. */
  onError?: (error: LLMError) => void;
}

// ── Generation Options ──────────────────────────────────────

/** Optional parameters for LLM generation (temperature, token limit, etc.). */
export interface LLMGenerateOptions {
  /** Sampling temperature (0–2). */
  temperature?: number;
  /** Maximum output tokens. */
  maxTokens?: number;
}

// ── LLM Client ──────────────────────────────────────────────

export class LLMClient {

  /**
   * Send a streaming chat request.
   *
   * Tokens are delivered via callbacks; the returned Promise resolves
   * with the full concatenated response text.
   */
  async chatStream(
    messages: ChatMessage[],
    settings: BrowserSettings,
    callbacks?: LLMStreamCallbacks,
    signal?: AbortSignal,
    options?: LLMGenerateOptions,
  ): Promise<string> {
    this.validateSettings(settings);

    const model = this.createModel(settings);
    const modelMessages = this.toModelMessages(messages);

    try {
      const result = streamText({
        model,
        messages: modelMessages,
        abortSignal: signal,
        maxRetries: 1,
        temperature: options?.temperature,
        maxOutputTokens: options?.maxTokens,
      });

      let fullText = '';
      for await (const chunk of result.textStream) {
        fullText += chunk;
        callbacks?.onToken?.(chunk);
      }

      callbacks?.onComplete?.(fullText);
      logger.info('Stream complete', { length: fullText.length });
      return fullText;
    } catch (err) {
      const llmError = this.classifyError(err);
      callbacks?.onError?.(llmError);
      throw llmError;
    }
  }

  /**
   * Send a non-streaming chat request.
   *
   * Returns the full response text.
   */
  async chat(
    messages: ChatMessage[],
    settings: BrowserSettings,
    signal?: AbortSignal,
    options?: LLMGenerateOptions,
  ): Promise<string> {
    this.validateSettings(settings);

    const model = this.createModel(settings);
    const modelMessages = this.toModelMessages(messages);

    try {
      const result = await generateText({
        model,
        messages: modelMessages,
        abortSignal: signal,
        maxRetries: 1,
        temperature: options?.temperature,
        maxOutputTokens: options?.maxTokens,
      });

      logger.info('Chat complete', { length: result.text.length });
      return result.text;
    } catch (err) {
      throw this.classifyError(err);
    }
  }

  // ── Internals ───────────────────────────────────────────

  private createModel(settings: BrowserSettings) {
    const provider = createOpenAICompatible({
      baseURL: settings.apiUrl.replace(/\/+$/, ''),
      apiKey: settings.apiKey,
      name: 'doli-llm',
      // Use safeFetch to avoid SugarCube's JSON.stringify contamination
      // which injects ["(revive:eval)", "undefined"] into request bodies.
      fetch: safeFetch as typeof globalThis.fetch,
    });
    return provider.chatModel(settings.modelName);
  }

  private toModelMessages(messages: ChatMessage[]): ModelMessage[] {
    return messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));
  }

  private validateSettings(settings: BrowserSettings): void {
    if (!settings.apiUrl || !settings.apiKey || !settings.modelName) {
      throw new LLMError(
        LLMErrorType.NOT_CONFIGURED,
        t('llm.not_configured'),
      );
    }
  }

  /**
   * Classify a raw error into a structured LLMError.
   *
   * The AI SDK surfaces HTTP errors as plain Error objects with
   * status information in the message. We parse those patterns
   * to produce an actionable error type.
   */
  private classifyError(err: unknown): LLMError {
    if (err instanceof LLMError) return err;

    const message = err instanceof Error ? err.message : String(err);
    const name = err instanceof Error ? err.name : '';

    // Abort / timeout
    if (name === 'AbortError' || message.includes('aborted')) {
      return new LLMError(LLMErrorType.TIMEOUT, t('llm.timeout'), message);
    }

    // HTTP status-based classification
    if (message.includes('401') || message.includes('403') || message.includes('Unauthorized')) {
      return new LLMError(LLMErrorType.AUTH_ERROR, t('llm.auth_error'), message);
    }
    if (message.includes('429') || message.toLowerCase().includes('rate limit')) {
      return new LLMError(LLMErrorType.RATE_LIMIT, t('llm.rate_limit'), message);
    }
    if (message.includes('404') || message.toLowerCase().includes('model not found')) {
      return new LLMError(LLMErrorType.MODEL_ERROR, t('llm.model_error'), message);
    }
    if (message.toLowerCase().includes('content_filter') || message.toLowerCase().includes('content filter')) {
      return new LLMError(LLMErrorType.CONTENT_FILTER, t('llm.content_filter'), message);
    }

    // Network errors (fetch TypeError)
    if (err instanceof TypeError || message.includes('fetch') || message.toLowerCase().includes('network')) {
      return new LLMError(LLMErrorType.NETWORK_ERROR, t('llm.network_error'), message);
    }

    return new LLMError(LLMErrorType.UNKNOWN, t('llm.unknown_error'), message);
  }
}
