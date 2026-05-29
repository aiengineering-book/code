import type { MiddlewareHandler } from 'hono';

// ch06 不需要真实的用户系统，用固定 ID 演示成本追踪
// 完整的 JWT 认证在 ch04
const DEMO_USER_ID = '00000000-0000-0000-0000-000000000000';

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  c.set('userId', DEMO_USER_ID);
  return next();
};
