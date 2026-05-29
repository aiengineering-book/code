// #book-ref ch04-jwt-utils
import jwt from 'jsonwebtoken';
import { env } from '../env.js';
import { UnauthorizedError } from '../errors.js';

export interface JwtPayload {
  userId: string;
  email: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): JwtPayload {
  try {
    return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
  } catch {
    throw new UnauthorizedError('Token 无效或已过期');
  }
}
// #endbook-ref
