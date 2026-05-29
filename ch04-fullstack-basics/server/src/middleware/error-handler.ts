import type { ErrorHandler } from 'hono';
import { AppError } from '../errors.js';

export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof AppError) {
    return c.json({ error: { message: err.message } }, err.statusCode as any);
  }

  console.error('Unhandled error:', err);
  return c.json({ error: { message: 'Internal Server Error' } }, 500);
};
