// #book-ref ch11-rag/server/src/index.ts
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { env } from './env.js';
import documentsRouter from './routes/documents.js';
import kbRouter from './routes/knowledge-bases.js';
import ragRouter from './routes/rag.js';
import searchRouter from './routes/search.js';

const app = new Hono()
  .route('/api/search', searchRouter)
  .route('/api/documents', documentsRouter)
  .route('/api/rag', ragRouter)
  .route('/api/knowledge-bases', kbRouter);

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`Server running at http://localhost:${info.port}`);
});

export default app;
