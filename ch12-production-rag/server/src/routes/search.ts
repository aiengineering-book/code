// #book-ref ch11-rag/server/src/routes/search.ts
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { vectorSearch } from '../services/vector-service.js';

const SearchSchema = z.object({
  query: z.string().min(1).max(500),
  limit: z.coerce.number().int().min(1).max(20).default(5),
  minScore: z.coerce.number().min(0).max(1).default(0.5),
});

const searchRouter = new Hono()
  .use('*', authMiddleware)
  .get('/', zValidator('query', SearchSchema), async (c) => {
    const { query, limit, minScore } = c.req.valid('query');

    const results = await vectorSearch(query, { limit, minScore });

    return c.json({
      query,
      results: results.map((r) => ({
        id: r.id,
        content: r.content,
        score: Math.round(r.score * 1000) / 1000, // Round to 3 decimal places
        metadata: r.metadata,
      })),
    });
  });

export default searchRouter;
