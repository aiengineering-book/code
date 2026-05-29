// #book-ref ch23-llm-traced
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions.js';
import type { LLMCallOptions } from './llm.js';
import { langfuse } from './observability.js';
import { DEFAULT_MODEL, openai } from './openai.js';

/**
 * 带追踪的 LLM 调用
 */
export async function callLLMTraced(
  messages: ChatCompletionMessageParam[],
  options: LLMCallOptions & {
    // 追踪元数据
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

  // 创建追踪会话
  const traceParams: Record<string, unknown> = {
    name: traceName,
    input: { messages, system },
  };
  if (userId !== undefined) traceParams.userId = userId;
  if (sessionId !== undefined) traceParams.sessionId = sessionId;
  if (metadata !== undefined) traceParams.metadata = metadata;
  const trace = langfuse.trace(traceParams as any);

  // 创建 Generation（LLM 调用记录）
  const generation = trace.generation({
    name: 'openai-chat-completions',
    model: DEFAULT_MODEL,
    input: messages,
    modelParameters: {
      maxTokens,
      temperature,
    },
    // @ts-expect-error — exactOptionalPropertyTypes 与 Langfuse 类型不兼容
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

    // 记录成功结果
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
      statusMessage: `耗时 ${Date.now() - startTime}ms`,
    });

    trace.update({ output: text });

    return {
      text,
      inputTokens: response.usage?.prompt_tokens ?? 0,
      outputTokens: response.usage?.completion_tokens ?? 0,
    };
  } catch (error) {
    // 记录错误
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
 * 用户反馈记录（点赞/踩）
 * 在前端调用，传入 traceId
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
// #endbook-ref
