// #book ch04-auth-middleware
// ch04-fullstack-basics/server/src/middleware/auth.ts
import type { MiddlewareHandler } from 'hono';
import { UnauthorizedError } from '../errors.js';
import { verifyToken } from '../utils/jwt.js';

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const authorization = c.req.header('Authorization');

  if (!authorization?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing Authorization header');
  }

  const token = authorization.slice(7); // Strip "Bearer " prefix
  const payload = verifyToken(token); // Throws UnauthorizedError if invalid

  // Store user info in request context; routes retrieve it with c.get('userId')
  c.set('userId', payload.userId);
  c.set('userEmail', payload.email);

  await next(); // Continue to the route handler
};
// #endbook
