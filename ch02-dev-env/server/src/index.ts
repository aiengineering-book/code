// #book ch02-server-index
// ch02-dev-env/server/src/index.ts
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

const app = new Hono();

// Middleware
app.use('*', logger());
app.use(
  '/api/*',
  cors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  }),
);

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Route placeholder (filled in as chapters progress)
app.get('/api', (c) => {
  return c.json({ message: 'API is running' });
});

const port = Number(process.env.PORT) || 3000;

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`🚀 Server running at http://localhost:${info.port}`);
});

export type AppType = typeof app;
// #endbook
