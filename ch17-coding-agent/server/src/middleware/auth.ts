// #book-ref ch16-multi-agent/server/src/middleware/auth.ts
// Stub: 演示用的鉴权中间件，完整实现见 ch04
import { createMiddleware } from 'hono/factory';

export const authMiddleware = createMiddleware(async (c, next) => {
  c.set('userId', 'demo-user');
  await next();
});
