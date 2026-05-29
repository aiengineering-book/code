// #book ch06-callLLM
// ch06-llm-api/server/src/lib/llm.ts
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions.js';
import { ExternalServiceError } from '../errors.js';
import { DEFAULT_MODEL, openai } from './openai.js';
import { withRetry } from './retry.js';

export interface LLMCallOptions {
  system?: string | undefined;
  maxTokens?: number;
  temperature?: number;
  retries?: number;
}

/**
 * Non-streaming LLM call with retry, error translation, and token tracking
 */
export async function callLLM(
  messages: ChatCompletionMessageParam[],
  options: LLMCallOptions = {},
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  try {
    const allMessages: ChatCompletionMessageParam[] = options.system
      ? [{ role: 'system' as const, content: options.system }, ...messages]
      : messages;

    const response = await withRetry(
      () =>
        openai.chat.completions.create({
          model: DEFAULT_MODEL,
          max_completion_tokens: options.maxTokens ?? 2048,
          temperature: options.temperature ?? 0.7,
          messages: allMessages,
        }),
      { maxAttempts: options.retries ?? 3 },
    );

    const choice = response.choices[0]!;
    if (choice.finish_reason === 'length') {
      // Output truncated — log a warning but don't throw (let the caller decide how to handle it)
      console.warn('[callLLM] Output truncated — consider increasing maxTokens');
    }

    return {
      text: choice.message.content ?? '',
      inputTokens: response.usage?.prompt_tokens ?? 0,
      outputTokens: response.usage?.completion_tokens ?? 0,
    };
  } catch (error) {
    throw new ExternalServiceError('LLM API', error);
  }
}
// #endbook
