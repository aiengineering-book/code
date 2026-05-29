// #book-ref ch04-jwt-utils
// ch04-fullstack-basics/server/src/utils/jwt.ts
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
    throw new UnauthorizedError('Token is invalid or expired');
  }
}
