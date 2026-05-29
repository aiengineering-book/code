// Stub: demo auth middleware — see ch04 for full implementation
import { createMiddleware } from 'hono/factory';

export const authMiddleware = createMiddleware(async (c, next) => {
  c.set('userId', 'demo-user');
  await next();
});
