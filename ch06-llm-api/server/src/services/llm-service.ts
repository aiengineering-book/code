// #book ch06-llm-service
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions.js';
// ch06-llm-api/server/src/services/llm-service.ts
import { ExternalServiceError } from '../errors.js';
import { estimateCost } from '../lib/cost.js';
import { DEFAULT_MODEL, openai } from '../lib/openai.js';
import { withRetry } from '../lib/retry.js';
import { trackUsage } from '../lib/usage-tracker.js';

export interface LLMServiceOptions {
  userId: string;
  endpoint: string;
  system?: string | undefined;
  maxTokens?: number;
  temperature?: number;
}

export class LLMService {
  private buildMessages(
    messages: ChatCompletionMessageParam[],
    system?: string,
  ): ChatCompletionMessageParam[] {
    return system
      ? [{ role: 'system', content: system }, ...messages]
      : messages;
  }

  /** 非流式：等待完整回复 */
  async complete(
    messages: ChatCompletionMessageParam[],
    options: LLMServiceOptions,
  ): Promise<string> {
    try {
      const response = await withRetry(() =>
        openai.chat.completions.create({
          model: DEFAULT_MODEL,
          max_completion_tokens: options.maxTokens ?? 2048,
          temperature: options.temperature ?? 0.7,
          messages: this.buildMessages(messages, options.system),
        }),
      );

      const usage = response.usage;
      if (usage) {
        await trackUsage({
          userId: options.userId,
          model: DEFAULT_MODEL,
          inputTokens: usage.prompt_tokens,
          outputTokens: usage.completion_tokens,
          costUsd: estimateCost(
            DEFAULT_MODEL,
            usage.prompt_tokens,
            usage.completion_tokens,
          ),
          endpoint: options.endpoint,
        });
      }

      return response.choices[0]?.message.content ?? '';
    } catch (error) {
      if (error instanceof ExternalServiceError) throw error;
      throw new ExternalServiceError('LLM API', error);
    }
  }

  /** 流式：边生成边返回，使用 AsyncGenerator */
  async *stream(
    messages: ChatCompletionMessageParam[],
    options: LLMServiceOptions,
  ): AsyncIterable<string> {
    const completion = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      max_completion_tokens: options.maxTokens ?? 2048,
      temperature: options.temperature ?? 0.7,
      messages: this.buildMessages(messages, options.system),
      stream: true,
      stream_options: { include_usage: true },
    });

    try {
      for await (const chunk of completion) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          yield delta;
        }

        // 最后一个 chunk 带 usage
        if (chunk.usage) {
          await trackUsage({
            userId: options.userId,
            model: DEFAULT_MODEL,
            inputTokens: chunk.usage.prompt_tokens,
            outputTokens: chunk.usage.completion_tokens,
            costUsd: estimateCost(
              DEFAULT_MODEL,
              chunk.usage.prompt_tokens,
              chunk.usage.completion_tokens,
            ),
            endpoint: options.endpoint,
          });
        }
      }
    } catch (error) {
      throw new ExternalServiceError('LLM API', error);
    }
  }
}

export const llmService = new LLMService();
// #endbook
