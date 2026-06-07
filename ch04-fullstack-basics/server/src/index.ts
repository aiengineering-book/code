// #book ch04-server-main
// ch04-fullstack-basics/server/src/index.ts
import 'dotenv/config';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { env } from './env.js';
import { errorHandler } from './middleware/error-handler.js';
import auth from './routes/auth.js';
import todoRouter from './routes/todos.js';

const app = new Hono()
  .use('*', logger()) // Log every request
  .use('/api/*', cors({ origin: env.CORS_ORIGIN })) // Allow frontend cross-origin requests
  .get('/health', (c) => c.json({ status: 'ok' })) // Health check for deployment platforms
  .route('/api/auth', auth) // Auth routes (section 4.10)
  .route('/api/todos', todoRouter) // Todo routes (section 4.11)
  .onError(errorHandler); // Centralized error handling

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`🚀 Server running at http://localhost:${info.port}`);
});

// Export the type so the frontend can build a type-safe API client
export type AppType = typeof app;
// #endbook
