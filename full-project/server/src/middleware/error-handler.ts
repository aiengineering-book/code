import type { ErrorHandler } from 'hono';
import { AppError, RateLimitError } from '../errors.js';

export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof RateLimitError) {
    c.header('Retry-After', String(err.retryAfterSeconds));
    return c.json(
      { error: { code: 'RATE_LIMIT_EXCEEDED', message: err.message } },
      429,
    );
  }

  if (err instanceof AppError) {
    return c.json({ error: { message: err.message } }, err.statusCode as any);
  }

  console.error('Unhandled error:', err);
  return c.json({ error: { message: 'Internal Server Error' } }, 500);
};
