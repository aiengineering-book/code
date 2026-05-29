// #book-ref ch04-auth-middleware
import type { MiddlewareHandler } from 'hono';
import { UnauthorizedError } from '../errors.js';
import { verifyToken } from '../utils/jwt.js';

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const authorization = c.req.header('Authorization');

  if (!authorization?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing Authorization header');
  }

  const token = authorization.slice(7);
  const payload = verifyToken(token);

  c.set('userId', payload.userId);
  c.set('userEmail', payload.email);

  await next();
};
// #endbook-ref
