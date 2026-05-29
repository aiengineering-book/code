// #book ch02-server-index
import { serve } from '@hono/node-server';
// ch02-dev-env/server/src/index.ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

const app = new Hono();

// 中间件
app.use('*', logger());
app.use(
  '/api/*',
  cors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  }),
);

// 健康检查
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 路由占位（后续章节逐步填充）
app.get('/api', (c) => {
  return c.json({ message: 'API is running' });
});

const port = Number(process.env.PORT) || 3000;

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`🚀 Server running at http://localhost:${info.port}`);
});

export type AppType = typeof app;
// #endbook
