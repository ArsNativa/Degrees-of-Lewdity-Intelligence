/**
 * ReAct Agent — orchestrates multi-step tool-calling loops via AI SDK.
 *
 * Assistant conversation state is passed as UIMessage[], then converted through
 * AI SDK's official pipeline (`validateUIMessages` + `convertToModelMessages`).
 * This preserves provider-specific metadata (e.g. Gemini thought signatures)
 * across multi-turn tool calling.
 */
import { convertToModelMessages, streamText, stepCountIs, validateUIMessages, type UIMessage } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { Logger } from '../utils/logger.js';
import { t } from '../utils/i18n/index.js';
import { safeFetch } from '../utils/safe-json.js';
import { createToolSet, getToolNames } from './tools/index.js';
import { LLMError, LLMErrorType, classifyError } from './llm.js';
import type { BrowserSettings } from '../utils/settings/index.js';

const logger = new Logger('Agent');

// ── Public types ────────────────────────────────────────────

/** Information about a tool call that just started. */
export interface ToolCallInfo {
  toolName: string;
  args: unknown;
  callId?: string;
}

/** Information about a tool result that just completed. */
export interface ToolResultInfo {
  toolName: string;
  result: unknown;
  ok: boolean;
  errorText?: string;
  callId?: string;
}

/** Information about a completed step. */
export interface StepInfo {
  stepNumber: number;
  text: string;
  toolCalls: ToolCallInfo[];
  toolResults: ToolResultInfo[];
  finishReason: string;
}

/** Callbacks for ReAct agent execution events. */
export interface AgentCallbacks {
  /** Streaming text token received. */
  onToken?: (token: string) => void;
  /** Streaming reasoning token received. */
  onReasoningToken?: (token: string) => void;
  /** A tool call is about to be executed. */
  onToolCall?: (info: ToolCallInfo) => void;
  /** A tool call has completed. */
  onToolResult?: (info: ToolResultInfo) => void;
  /** A step (LLM call) has completed. */
  onStepComplete?: (info: StepInfo) => void;
  /** The entire agent run has completed. */
  onComplete?: (fullText: string, totalSteps: number) => void;
  /** An error occurred during execution. */
  onError?: (error: LLMError) => void;
}

/** Options for a single agent run. */
export interface AgentRunOptions {
  /** Full UI message history from the active thread. */
  messages: UIMessage[];
  /** Optional system prompt sent as `streamText.system`. */
  systemPrompt?: string;
  /** Current settings (API URL, key, model, etc.). */
  settings: BrowserSettings;
  /** Maximum ReAct tool-call steps. */
  maxSteps: number;
  /** Sampling temperature (0–2). */
  temperature?: number;
  /** Event callbacks. */
  callbacks?: AgentCallbacks;
  /** AbortSignal for cancellation. */
  signal?: AbortSignal;
}

/** Result of a completed agent run. */
export interface AgentRunResult {
  /** The final text response. */
  text: string;
  /** Number of LLM steps used. */
  totalSteps: number;
  /** Details of each step that was completed. */
  steps: StepInfo[];
  /** Full updated UI messages for persistence. */
  messages: UIMessage[];
}

// ── Agent ───────────────────────────────────────────────────

export class Agent {
  private tools = createToolSet();

  constructor() {
    logger.info('Agent created with tools:', getToolNames().join(', '));
  }

  /**
   * Run the ReAct agent with streaming output.
   *
   * Returns a promise that resolves with final assistant text, step info,
   * and full persisted UI messages.
   */
  async run(options: AgentRunOptions): Promise<AgentRunResult> {
    const {
      messages,
      systemPrompt,
      settings,
      callbacks,
      signal,
      maxSteps: rawMaxSteps,
      temperature: rawTemperature,
    } = options;

    this.validateSettings(settings);

    const model = this.createModel(settings);
    const maxSteps = rawMaxSteps || 6;
    const temperature = this.clamp(typeof rawTemperature === 'number' ? rawTemperature : 0.7, 0, 2);
    const completedSteps: StepInfo[] = [];
    let fullText = '';
    let finalMessages: UIMessage[] | null = null;

    logger.info(`Starting agent run (maxSteps=${maxSteps}, temperature=${temperature})`);

    try {
      const validatedMessages = await validateUIMessages({
        messages,
        tools: this.tools as any,
      });
      const modelMessages = await convertToModelMessages(validatedMessages, {
        tools: this.tools,
      });

      const result = streamText({
        model,
        system: systemPrompt?.trim() || undefined,
        messages: modelMessages,
        tools: this.tools,
        stopWhen: stepCountIs(maxSteps),
        abortSignal: signal,
        maxRetries: 1,
        temperature,
        onChunk: ({ chunk }) => {
          if (chunk.type === 'text-delta') {
            fullText += chunk.text;
            callbacks?.onToken?.(chunk.text);
            return;
          }
          if (chunk.type === 'reasoning-delta') {
            callbacks?.onReasoningToken?.(chunk.text);
          }
        },

        // ── Per-tool-call callbacks ──────────────────────

        experimental_onToolCallStart: async (event) => {
          const toolName = event.toolCall.toolName;
          const args = (event.toolCall as any).input ?? (event.toolCall as any).args;
          const info: ToolCallInfo = { toolName, args, callId: event.toolCall.toolCallId };
          logger.info(`Tool call: ${toolName}`, args);
          callbacks?.onToolCall?.(info);
        },

        experimental_onToolCallFinish: async (event) => {
          const toolName = event.toolCall.toolName;
          const resultValue = event.success ? event.output : event.error;
          const info: ToolResultInfo = {
            toolName,
            result: resultValue,
            ok: event.success,
            errorText: event.success ? undefined : String(event.error),
            callId: event.toolCall.toolCallId,
          };
          logger.info(`Tool result: ${toolName}`, resultValue);
          callbacks?.onToolResult?.(info);
        },

        // ── Step-level callback ─────────────────────────

        onStepFinish: (event) => {
          const stepInfo: StepInfo = {
            stepNumber: event.stepNumber,
            text: event.text || '',
            toolCalls: (event.toolCalls || []).map((tc: any) => ({
              toolName: tc.toolName,
              args: tc.args ?? tc.input,
              callId: tc.toolCallId,
            })),
            toolResults: (event.toolResults || []).map((tr: any) => ({
              toolName: tr.toolName,
              result: tr.result,
              ok: tr.error == null,
              errorText: tr.error ? String(tr.error) : undefined,
              callId: tr.toolCallId,
            })),
            finishReason: event.finishReason,
          };
          completedSteps.push(stepInfo);
          logger.info(
            `Step ${event.stepNumber} complete (reason=${event.finishReason},` +
            ` toolCalls=${stepInfo.toolCalls.length})`,
          );
          callbacks?.onStepComplete?.(stepInfo);
        },
      });

      // Consume the UI message stream so we can persist provider metadata safely.
      const uiMessageStream = result.toUIMessageStream<UIMessage>({
        originalMessages: validatedMessages,
        sendReasoning: true,
        onFinish: ({ messages: finishedMessages }) => {
          finalMessages = this.cloneMessages(finishedMessages);
        },
      });

      for await (const _ of uiMessageStream) {
        // stream consumed intentionally; live UI updates come from callbacks above
      }

      const totalSteps = completedSteps.length;
      const resolvedMessages = finalMessages ?? this.cloneMessages(validatedMessages);
      if (!fullText.trim()) {
        fullText = this.extractLatestAssistantText(resolvedMessages);
      }

      logger.info(`Agent run complete: ${totalSteps} step(s), ${fullText.length} chars`);
      callbacks?.onComplete?.(fullText, totalSteps);

      return {
        text: fullText,
        totalSteps,
        steps: completedSteps,
        messages: resolvedMessages,
      };
    } catch (err) {
      const llmError = classifyError(err);
      logger.error('Agent run failed:', llmError.type, llmError.message);
      callbacks?.onError?.(llmError);
      throw llmError;
    }
  }

  // ── Internals ───────────────────────────────────────────

  private createModel(settings: BrowserSettings) {
    const providerName = this.resolveProviderName(settings);
    const provider = createOpenAICompatible({
      baseURL: settings.apiUrl.replace(/\/+$/, ''),
      apiKey: settings.apiKey,
      // NOTE:
      // openai-compatible currently reads Gemini thought signatures from
      // `providerOptions.google.thoughtSignature` when re-sending tool calls.
      // Use provider name "google" for Gemini-compatible endpoints so
      // thought_signature can be preserved across turns.
      name: providerName,
      fetch: safeFetch as typeof globalThis.fetch,
    });
    return provider.chatModel(settings.modelName);
  }

  private validateSettings(settings: BrowserSettings): void {
    if (!settings.apiUrl || !settings.apiKey || !settings.modelName) {
      throw new LLMError(
        LLMErrorType.NOT_CONFIGURED,
        t('llm.not_configured'),
      );
    }
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  private extractLatestAssistantText(messages: ReadonlyArray<UIMessage>): string {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const msg = messages[i];
      if (msg.role !== 'assistant' || !Array.isArray(msg.parts)) continue;
      const text = (msg.parts as any[])
        .filter((part) => part?.type === 'text' && typeof part.text === 'string')
        .map((part) => part.text)
        .join('');
      if (text.trim()) return text;
    }
    return '';
  }

  private cloneMessages(messages: ReadonlyArray<UIMessage>): UIMessage[] {
    try {
      return JSON.parse(JSON.stringify(messages)) as UIMessage[];
    } catch {
      return [...messages];
    }
  }

  private resolveProviderName(settings: BrowserSettings): string {
    const model = settings.modelName.toLowerCase();
    const url = settings.apiUrl.toLowerCase();
    if (
      model.includes('gemini')
      || url.includes('generativelanguage.googleapis.com')
      || url.includes('aiplatform.googleapis.com')
      || url.includes('googleapis.com')
      || url.includes('vertex')
    ) {
      return 'google';
    }
    return 'openaiCompatible';
  }
}
