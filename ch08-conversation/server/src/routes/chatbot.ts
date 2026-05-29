// #book ch08-chatbot-route
// ch08-conversation/server/src/routes/chatbot.ts

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

  // List conversations
  .get('/conversations', async (c) => {
    const userId = c.get('userId');
    const list = await conversationService.listByUser(userId);
    return c.json(list);
  })

  // Get message history for a conversation
  .get('/conversations/:id/messages', async (c) => {
    const userId = c.get('userId');
    const { id } = c.req.param();
    await conversationService.getById(id, userId); // Authorization check
    const msgs = await conversationService.getMessages(id);
    return c.json(msgs);
  })

  // Delete a conversation
  .delete('/conversations/:id', async (c) => {
    const userId = c.get('userId');
    const { id } = c.req.param();
    await conversationService.delete(id, userId);
    return c.json({ success: true });
  })

  // Send a message (streaming)
  .post('/stream', zValidator('json', SendMessageSchema), async (c) => {
    const userId = c.get('userId');
    const { message, conversationId } = c.req.valid('json');

    // Create a new conversation if none exists
    let convId = conversationId;
    if (!convId) {
      const newConv = await conversationService.create(userId, message);
      convId = newConv.id;
    }

    return streamSSE(c, async (stream) => {
      // Send the conversation ID first (frontend needs to save it)
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
            message: error instanceof Error ? error.message : 'An error occurred',
          }),
        });
      }
    });
  });

export default chatbotRouter;
// #endbook
