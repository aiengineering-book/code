// #book-ref ch11-rag/server/src/routes/rag.ts
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { ragService } from '../services/rag-service.js';

const QuerySchema = z.object({
  question: z.string().min(1).max(1000),
  documentId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(10).default(5),
  useRerank: z.coerce.boolean().default(true),
});

const ragRouter = new Hono()
  .use('*', authMiddleware)

  // 非流式问答
  .post('/query', zValidator('json', QuerySchema), async (c) => {
    const params = c.req.valid('json');
    const result = await ragService.query(params.question, params);
    return c.json(result);
  })

  // 流式问答
  .post('/stream', zValidator('json', QuerySchema), async (c) => {
    const params = c.req.valid('json');

    return streamSSE(c, async (stream) => {
      for await (const chunk of ragService.queryStream(
        params.question,
        params,
      )) {
        if (chunk.type === 'citations') {
          await stream.writeSSE({
            event: 'citations',
            data: JSON.stringify({ citations: chunk.citations }),
          });
        } else if (chunk.type === 'delta') {
          await stream.writeSSE({
            event: 'delta',
            data: JSON.stringify({ text: chunk.text }),
          });
        } else {
          await stream.writeSSE({ event: 'done', data: '{}' });
        }
      }
    });
  });

export default ragRouter;
