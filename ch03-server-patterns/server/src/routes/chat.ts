// #book ch03-chat-route
// ch03-server-patterns/server/src/routes/chat.ts

import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

const SendMessageSchema = z.object({
  content: z.string().min(1).max(4000),
  conversationId: z.string().uuid().optional().or(z.null()),
});

const chat = new Hono()
  .post('/messages', zValidator('json', SendMessageSchema), async (c) => {
    const { content, conversationId } = c.req.valid('json');
    // content and conversationId are validated and type-safe
    const message = await sendMessage({ content, conversationId });
    return c.json(message, 201);
  })
  .get('/conversations', async (c) => {
    const conversations = await listConversations();
    return c.json(conversations);
  });

export default chat;
export type ChatRouteType = typeof chat;
// #endbook
