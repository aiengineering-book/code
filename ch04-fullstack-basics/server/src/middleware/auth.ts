// #book ch04-auth-middleware
import type { MiddlewareHandler } from 'hono';
// ch04-fullstack-basics/server/src/middleware/auth.ts
import { UnauthorizedError } from '../errors.js';
import { verifyToken } from '../utils/jwt.js';

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const authorization = c.req.header('Authorization');

  if (!authorization?.startsWith('Bearer ')) {
    throw new UnauthorizedError('缺少 Authorization Header');
  }

  const token = authorization.slice(7); // 去掉 "Bearer " 前缀
  const payload = verifyToken(token); // 验证失败会抛出 UnauthorizedError

  // 把用户信息存入请求上下文，后续路由通过 c.get('userId') 取用
  c.set('userId', payload.userId);
  c.set('userEmail', payload.email);

  await next(); // 继续执行后续路由
};
// #endbook
