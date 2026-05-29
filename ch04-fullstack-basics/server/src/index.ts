// #book ch04-server-main
import 'dotenv/config';
// ch04-fullstack-basics/server/src/index.ts
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { env } from './env.js';
import { errorHandler } from './middleware/error-handler.js';
import auth from './routes/auth.js';
import todoRouter from './routes/todos.js';

const app = new Hono()
  .use('*', logger()) // 所有请求打印日志
  .use('/api/*', cors({ origin: env.CORS_ORIGIN })) // 允许前端跨域请求
  .get('/health', (c) => c.json({ status: 'ok' })) // 健康检查（部署平台用来探活）
  .route('/api/auth', auth) // 认证相关路由，见 4.10
  .route('/api/todos', todoRouter) // 待办相关路由，见 4.11
  .onError(errorHandler); // 统一错误处理

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`🚀 服务启动在 http://localhost:${info.port}`);
});

// 导出类型，前端可以用它生成类型安全的 API 客户端
export type AppType = typeof app;
// #endbook
