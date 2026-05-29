// #book-ref ch12-production-rag/server/src/middleware/auth.ts
import type { MiddlewareHandler } from 'hono';

const DEMO_USER_ID = '00000000-0000-0000-0000-000000000000';

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  c.set('userId', DEMO_USER_ID);
  return next();
};
