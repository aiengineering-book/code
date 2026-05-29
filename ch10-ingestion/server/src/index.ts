import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { env } from './env.js';
import documentsRouter from './routes/documents.js';
import searchRouter from './routes/search.js';

const app = new Hono()
  .route('/api/search', searchRouter)
  .route('/api/documents', documentsRouter);

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`Server running at http://localhost:${info.port}`);
});

export default app;
