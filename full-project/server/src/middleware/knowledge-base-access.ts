// #book-ref ch12-kb-access
// ch12-production-rag/server/src/middleware/knowledge-base-access.ts

import { and, eq } from 'drizzle-orm';
import type { MiddlewareHandler } from 'hono';
import { db } from '../database/client.js';
import { knowledgeBaseMembers, knowledgeBases } from '../database/schema.js';
import { NotFoundError, UnauthorizedError } from '../errors.js';

const ROLE_LEVEL = { viewer: 0, editor: 1, admin: 2 } as const;

export function requireKnowledgeBaseAccess(
  minRole: keyof typeof ROLE_LEVEL = 'viewer',
): MiddlewareHandler {
  return async (c, next) => {
    const userId = c.get('userId') as string;
    const kbId = c.req.param('kbId') ?? c.req.query('kbId');
    if (!kbId) {
      await next();
      return;
    }

    const kb = await db.query.knowledgeBases.findFirst({
      where: eq(knowledgeBases.id, kbId),
    });
    if (!kb) throw new NotFoundError('KnowledgeBase', kbId);

    // Owner always passes
    if (kb.ownerId === userId) {
      c.set('knowledgeBase', kb);
      await next();
      return;
    }

    // Public knowledge bases pass for viewer access
    if (kb.visibility === 'public' && minRole === 'viewer') {
      c.set('knowledgeBase', kb);
      await next();
      return;
    }

    // Check member role
    const member = await db.query.knowledgeBaseMembers.findFirst({
      where: and(
        eq(knowledgeBaseMembers.knowledgeBaseId, kbId),
        eq(knowledgeBaseMembers.userId, userId),
      ),
    });

    if (!member || ROLE_LEVEL[member.role] < ROLE_LEVEL[minRole]) {
      throw new UnauthorizedError('Access to this knowledge base is not permitted');
    }

    c.set('knowledgeBase', kb);
    await next();
  };
}
