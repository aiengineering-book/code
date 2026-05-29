// #book ch06-chat-stream

// ch06-llm-api/server/src/routes/chat-raw.ts
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions.js';
import { z } from 'zod';
import { DEFAULT_MODEL, openai } from '../lib/openai.js';
import { authMiddleware } from '../middleware/auth.js';

const SendMessageSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1),
      }),
    )
    .min(1),
  system: z.string().optional(),
});

const chatRouter = new Hono()
  .use('*', authMiddleware)
  .post('/stream', zValidator('json', SendMessageSchema), async (c) => {
    const { messages, system } = c.req.valid('json');

    // 把 system prompt 拼进 messages 数组
    const allMessages: ChatCompletionMessageParam[] = [
      ...(system ? [{ role: 'system' as const, content: system }] : []),
      ...(messages as ChatCompletionMessageParam[]),
    ];

    return streamSSE(c, async (stream) => {
      try {
        const completion = await openai.chat.completions.create({
          model: DEFAULT_MODEL,
          max_completion_tokens: 2048,
          messages: allMessages,
          stream: true,
          stream_options: { include_usage: true }, // 让最后一个 chunk 带 usage
        });

        // 把 OpenAI 的 chunk 流转换成 SSE 格式推送给前端
        for await (const chunk of completion) {
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) {
            // 每次有新的文字片段，推送 delta 事件
            await stream.writeSSE({
              event: 'delta',
              data: JSON.stringify({ text: delta }),
            });
          }

          // 最后一个 chunk 带 usage 统计（需要 stream_options.include_usage）
          if (chunk.usage) {
            await stream.writeSSE({
              event: 'done',
              data: JSON.stringify({
                inputTokens: chunk.usage.prompt_tokens,
                outputTokens: chunk.usage.completion_tokens,
              }),
            });
          }
        }
      } catch (error) {
        await stream.writeSSE({
          event: 'error',
          data: JSON.stringify({
            message: error instanceof Error ? error.message : '未知错误',
          }),
        });
      }
    });
  });

export default chatRouter;
// #endbook
