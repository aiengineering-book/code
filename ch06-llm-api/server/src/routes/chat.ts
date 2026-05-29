// #book ch06-chat-route

// ch06-llm-api/server/src/routes/chat.ts
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { llmService } from '../services/llm-service.js';

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

type Env = { Variables: { userId: string } };

const chatRouter = new Hono<Env>()
  .use('*', authMiddleware)

  // 非流式：等完整回复再返回（适合后台任务、数据提取）
  .post('/complete', zValidator('json', SendMessageSchema), async (c) => {
    const { messages, system } = c.req.valid('json');
    const userId = c.get('userId'); // 由 authMiddleware 注入

    const text = await llmService.complete(messages, {
      userId,
      endpoint: 'chat/complete',
      system,
    });

    return c.json({ reply: text });
  })

  // 流式：边生成边推送（适合对话界面）
  .post('/stream', zValidator('json', SendMessageSchema), async (c) => {
    const { messages, system } = c.req.valid('json');
    const userId = c.get('userId');

    return streamSSE(c, async (stream) => {
      try {
        for await (const chunk of llmService.stream(messages, {
          userId,
          endpoint: 'chat/stream',
          system,
        })) {
          await stream.writeSSE({
            event: 'delta',
            data: JSON.stringify({ text: chunk }),
          });
        }

        await stream.writeSSE({ event: 'done', data: '{}' });
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
