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
  SERVER_ERROR = 'server_error',
  UNKNOWN = 'unknown',
}

export class LLMError extends Error {
  readonly type: LLMErrorType;
  readonly detail?: string;
  readonly statusCode?: number;

  constructor(type: LLMErrorType, message: string, detail?: string, statusCode?: number) {
    super(message);
    this.name = 'LLMError';
    this.type = type;
    this.detail = detail;
    this.statusCode = statusCode;
  }
}

// ── Error classification (shared by LLMClient & Agent) ──────

/**
 * Extract HTTP status code from an AI SDK error object.
 *
 * The SDK may store it on `status`, `statusCode`, or nested in `cause`.
 */
function extractStatusCode(err: unknown): number | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  const obj = err as Record<string, unknown>;
  for (const key of ['status', 'statusCode']) {
    if (typeof obj[key] === 'number') return obj[key] as number;
  }
  // Check nested cause
  if (typeof obj.cause === 'object' && obj.cause !== null) {
    const cause = obj.cause as Record<string, unknown>;
    for (const key of ['status', 'statusCode']) {
      if (typeof cause[key] === 'number') return cause[key] as number;
    }
  }
  // Try to parse from "Status code: 401" pattern in `url` or `message`
  const msg = typeof obj.message === 'string' ? obj.message : '';
  const m = /\bstatus\s*(?:code)?[:=\s]*(\d{3})\b/i.exec(msg);
  if (m) return Number(m[1]);

  return undefined;
}

/**
 * Extract the raw response body from an AI SDK error.
 *
 * AI SDK may store it on `responseBody`, `data`, or `cause.responseBody`.
 * Returns a parsed object when possible, otherwise the raw string.
 */
function extractResponseBody(err: unknown): unknown | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  const obj = err as Record<string, unknown>;

  const candidates: unknown[] = [
    obj.responseBody,
    obj.data,
    (obj.cause as Record<string, unknown> | undefined)?.responseBody,
  ];

  for (const raw of candidates) {
    if (raw == null) continue;
    if (typeof raw === 'string') {
      try { return JSON.parse(raw); } catch { return raw; }
    }
    return raw;
  }
  return undefined;
}

/**
 * Build a human-readable detail string for the collapsible error panel.
 *
 * Strategy: show HTTP status on the first line, then pretty-print the raw
 * response body as JSON.  If no body is available, fall back to the SDK
 * error message.
 */
function buildDetail(
  statusCode: number | undefined,
  responseBody: unknown | undefined,
  rawMsg: string,
): string {
  const lines: string[] = [];
  if (statusCode) lines.push(`HTTP ${statusCode}`);

  if (responseBody) {
    try {
      lines.push(JSON.stringify(responseBody, null, 2));
    } catch {
      lines.push(String(responseBody));
    }
  } else if (rawMsg) {
    lines.push(rawMsg);
  }

  return lines.join('\n');
}

/**
 * Classify an error type from HTTP status code.
 * Returns undefined if status code doesn't map to a known type.
 */
function classifyByStatusCode(code: number): LLMErrorType | undefined {
  if (code === 401 || code === 403) return LLMErrorType.AUTH_ERROR;
  if (code === 429) return LLMErrorType.RATE_LIMIT;
  if (code === 404) return LLMErrorType.MODEL_ERROR;
  if (code >= 500 && code < 600) return LLMErrorType.SERVER_ERROR;
  return undefined;
}

/**
 * Classify a raw error into a structured LLMError.
 *
 * Prefers structured extraction (HTTP status code, response body) over
 * fragile string matching.  String matching is kept as a fallback.
 */
export function classifyError(err: unknown): LLMError {
  if (err instanceof LLMError) return err;

  const message = err instanceof Error ? err.message : String(err);
  const name = err instanceof Error ? err.name : '';

  const statusCode = extractStatusCode(err);
  const responseBody = extractResponseBody(err);
  const detail = buildDetail(statusCode, responseBody, message);

  // Stringify the response body once for pattern matching below.
  const bodyStr = responseBody ? JSON.stringify(responseBody).toLowerCase() : '';

  // Abort / timeout — check first, independent of status code
  if (name === 'AbortError' || message.includes('aborted')) {
    return new LLMError(LLMErrorType.TIMEOUT, t('llm.timeout'), detail, statusCode);
  }

  // Structured: classify by HTTP status code
  if (statusCode) {
    const errType = classifyByStatusCode(statusCode);
    if (errType) {
      return new LLMError(errType, t(`llm.${errType}`), detail, statusCode);
    }
  }

  // Content filter — check SDK error message AND response body, because
  // some providers (e.g. Gemini via OpenAI-compat) return HTTP 200 with
  // finish_reason "content_filter: ..." but the SDK only surfaces a
  // generic parse error.
  const lowerMsg = message.toLowerCase();
  if (
    lowerMsg.includes('content_filter')
    || lowerMsg.includes('content filter')
    || bodyStr.includes('content_filter')
    || bodyStr.includes('content filter')
  ) {
    return new LLMError(LLMErrorType.CONTENT_FILTER, t('llm.content_filter'), detail, statusCode);
  }

  // Fallback: string matching on error message
  if (message.includes('401') || message.includes('403') || message.includes('Unauthorized')) {
    return new LLMError(LLMErrorType.AUTH_ERROR, t('llm.auth_error'), detail, statusCode);
  }
  if (message.includes('429') || lowerMsg.includes('rate limit')) {
    return new LLMError(LLMErrorType.RATE_LIMIT, t('llm.rate_limit'), detail, statusCode);
  }
  if (message.includes('404') || lowerMsg.includes('model not found')) {
    return new LLMError(LLMErrorType.MODEL_ERROR, t('llm.model_error'), detail, statusCode);
  }

  // Network errors (fetch TypeError)
  if (err instanceof TypeError || message.includes('fetch') || message.toLowerCase().includes('network')) {
    return new LLMError(LLMErrorType.NETWORK_ERROR, t('llm.network_error'), detail, statusCode);
  }

  return new LLMError(LLMErrorType.UNKNOWN, t('llm.unknown_error'), detail, statusCode);
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
      const llmError = classifyError(err);
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
      throw classifyError(err);
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
}
