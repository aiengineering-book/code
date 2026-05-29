// #book-ref ch08-chatbot-route

import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { chatbotService } from '../services/chatbot-service.js';
import { conversationService } from '../services/conversation-service.js';

const SendMessageSchema = z.object({
  message: z.string().min(1).max(2000),
  conversationId: z.string().uuid().optional().or(z.null()),
});

type Env = { Variables: { userId: string } };

const chatbotRouter = new Hono<Env>()
  .use('*', authMiddleware)

  // 获取会话列表
  .get('/conversations', async (c) => {
    const userId = c.get('userId');
    const list = await conversationService.listByUser(userId);
    return c.json(list);
  })

  // 获取单个会话的消息历史
  .get('/conversations/:id/messages', async (c) => {
    const userId = c.get('userId');
    const { id } = c.req.param();
    await conversationService.getById(id, userId);
    const msgs = await conversationService.getMessages(id);
    return c.json(msgs);
  })

  // 删除会话
  .delete('/conversations/:id', async (c) => {
    const userId = c.get('userId');
    const { id } = c.req.param();
    await conversationService.delete(id, userId);
    return c.json({ success: true });
  })

  // 流式发送消息
  .post('/stream', zValidator('json', SendMessageSchema), async (c) => {
    const userId = c.get('userId');
    const { message, conversationId } = c.req.valid('json');

    // 如果没有 conversationId，自动创建新会话
    let convId = conversationId;
    if (!convId) {
      const newConv = await conversationService.create(userId, message);
      convId = newConv.id;
    }

    return streamSSE(c, async (stream) => {
      // 先发送会话 ID（前端需要保存）
      await stream.writeSSE({
        event: 'conversation',
        data: JSON.stringify({ conversationId: convId }),
      });

      try {
        for await (const chunk of chatbotService.replyStream(
          convId,
          userId,
          message,
        )) {
          if (chunk.type === 'delta') {
            await stream.writeSSE({
              event: 'delta',
              data: JSON.stringify({ text: chunk.text }),
            });
          } else {
            await stream.writeSSE({
              event: 'done',
              data: JSON.stringify({
                inputTokens: chunk.inputTokens,
                outputTokens: chunk.outputTokens,
              }),
            });
          }
        }
      } catch (error) {
        await stream.writeSSE({
          event: 'error',
          data: JSON.stringify({
            message: error instanceof Error ? error.message : '发生错误',
          }),
        });
      }
    });
  });

export default chatbotRouter;
// #endbook-ref
