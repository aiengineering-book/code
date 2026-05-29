// #book-ref ch12-kb-router
// ch12-production-rag/server/src/routes/knowledge-bases.ts

import { zValidator } from '@hono/zod-validator';
import { eq, or } from 'drizzle-orm';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';
import { db } from '../database/client.js';
import { knowledgeBaseMembers, knowledgeBases } from '../database/schema.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireKnowledgeBaseAccess } from '../middleware/knowledge-base-access.js';
import { ragService } from '../services/rag-service.js';

type Env = { Variables: { userId: string; knowledgeBase?: unknown } };

const kbRouter = new Hono<Env>()
  .use('*', authMiddleware)

  .post(
    '/',
    zValidator(
      'json',
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().max(500).optional(),
        visibility: z.enum(['private', 'team', 'public']).default('private'),
      }),
    ),
    async (c) => {
      const userId = c.get('userId');
      const [kb] = await db
        .insert(knowledgeBases)
        .values({ ...c.req.valid('json'), ownerId: userId, ownerType: 'user' })
        .returning();
      return c.json(kb!, 201);
    },
  )

  .get('/', async (c) => {
    const userId = c.get('userId');
    const list = await db.query.knowledgeBases.findMany({
      where: or(
        eq(knowledgeBases.ownerId, userId),
        eq(knowledgeBases.visibility, 'public'),
      ),
      orderBy: (kb, { desc }) => [desc(kb.updatedAt)],
    });
    return c.json(list);
  })

  // Streaming Q&A restricted to this knowledge base
  .post(
    '/:kbId/stream',
    requireKnowledgeBaseAccess('viewer'),
    zValidator('json', z.object({ question: z.string().min(1).max(1000) })),
    async (c) => {
      const { kbId } = c.req.param();
      const { question } = c.req.valid('json');

      return streamSSE(c, async (stream) => {
        for await (const chunk of ragService.queryStream(question, {
          documentId: kbId,
          limit: 5,
        })) {
          if (chunk.type === 'citations') {
            await stream.writeSSE({
              event: 'citations',
              data: JSON.stringify(chunk),
            });
          } else if (chunk.type === 'delta') {
            await stream.writeSSE({
              event: 'delta',
              data: JSON.stringify(chunk),
            });
          } else {
            await stream.writeSSE({ event: 'done', data: '{}' });
          }
        }
      });
    },
  )

  // Add or update a member
  .post(
    '/:kbId/members',
    requireKnowledgeBaseAccess('admin'),
    zValidator(
      'json',
      z.object({
        userId: z.string().uuid(),
        role: z.enum(['viewer', 'editor', 'admin']).default('viewer'),
      }),
    ),
    async (c) => {
      const { kbId } = c.req.param();
      const body = c.req.valid('json');
      const [member] = await db
        .insert(knowledgeBaseMembers)
        .values({ knowledgeBaseId: kbId, ...body })
        .onConflictDoUpdate({
          target: [
            knowledgeBaseMembers.knowledgeBaseId,
            knowledgeBaseMembers.userId,
          ],
          set: { role: body.role },
        })
        .returning();
      return c.json(member!, 201);
    },
  );

export default kbRouter;
