// #book-ref ch23-llm-traced
// ch23-production/server/src/lib/llm-traced.ts
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions.js';
import type { LLMCallOptions } from './llm.js';
import { langfuse } from './observability.js';
import { DEFAULT_MODEL, openai } from './openai.js';

/**
 * LLM call with tracing
 */
export async function callLLMTraced(
  messages: ChatCompletionMessageParam[],
  options: LLMCallOptions & {
    // Trace metadata
    traceName?: string;
    userId?: string;
    sessionId?: string;
    metadata?: Record<string, unknown>;
  } = {},
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const {
    system,
    maxTokens = 2048,
    temperature = 0.7,
    traceName = 'llm-call',
    userId,
    sessionId,
    metadata,
  } = options;

  // Create tracing session
  const traceParams: Record<string, unknown> = {
    name: traceName,
    input: { messages, system },
  };
  if (userId !== undefined) traceParams.userId = userId;
  if (sessionId !== undefined) traceParams.sessionId = sessionId;
  if (metadata !== undefined) traceParams.metadata = metadata;
  const trace = langfuse.trace(traceParams as any);

  // Create Generation (LLM call record)
  const generation = trace.generation({
    name: 'openai-chat-completions',
    model: DEFAULT_MODEL,
    input: messages,
    modelParameters: {
      maxTokens,
      temperature,
    },
    // @ts-expect-error — exactOptionalPropertyTypes incompatible with Langfuse types
    prompt: system ? { system } : undefined,
  });

  const startTime = Date.now();

  try {
    const fullMessages: ChatCompletionMessageParam[] = system
      ? [{ role: 'system', content: system }, ...messages]
      : messages;

    const response = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      max_completion_tokens: maxTokens,
      temperature,
      messages: fullMessages,
    });

    const text = response.choices[0]?.message.content ?? '';

    // Record successful result
    generation.end({
      output: text,
      usage: {
        input: response.usage?.prompt_tokens ?? 0,
        output: response.usage?.completion_tokens ?? 0,
        total:
          (response.usage?.prompt_tokens ?? 0) +
          (response.usage?.completion_tokens ?? 0),
        unit: 'TOKENS',
      },
      level: 'DEFAULT',
      statusMessage: `${Date.now() - startTime}ms`,
    });

    trace.update({ output: text });

    return {
      text,
      inputTokens: response.usage?.prompt_tokens ?? 0,
      outputTokens: response.usage?.completion_tokens ?? 0,
    };
  } catch (error) {
    // Record error
    generation.end({
      level: 'ERROR',
      statusMessage: error instanceof Error ? error.message : String(error),
    });

    trace.update({
      output: { error: error instanceof Error ? error.message : String(error) },
    });

    throw error;
  }
}

/**
 * Record user feedback (thumbs up/down)
 * Called from the frontend with traceId
 */
export async function recordUserFeedback(
  traceId: string,
  score: 1 | 0 | -1,
  comment?: string,
): Promise<void> {
  const scoreParams: Record<string, unknown> = {
    traceId,
    name: 'user-feedback',
    value: score,
  };
  if (comment !== undefined) scoreParams.comment = comment;
  await langfuse.score(scoreParams as any);
}
