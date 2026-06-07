// #book-ref ch06-llm-api/server/src/middleware/auth.ts

import type { MiddlewareHandler } from 'hono';

// ch06 does not need a real user system — uses a fixed ID to demo cost tracking
// Full JWT auth is in ch04
const DEMO_USER_ID = '00000000-0000-0000-0000-000000000000';

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  c.set('userId', DEMO_USER_ID);
  return next();
};
