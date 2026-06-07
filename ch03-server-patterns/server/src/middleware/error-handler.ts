// #book ch03-error-handler
// ch03-server-patterns/server/src/middleware/error-handler.ts
import type { Context, Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { AppError } from '../errors.js';

interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export function errorHandler(err: Error, c: Context): Response {
  // Known application errors
  if (err instanceof AppError) {
    const body: ErrorResponse = {
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    };
    return c.json(body, err.statusCode as ContentfulStatusCode);
  }

  // Unknown errors (bugs)
  console.error('[Unhandled Error]', {
    message: err.message,
    stack: err.stack,
    path: c.req.path,
    method: c.req.method,
  });

  return c.json(
    {
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An internal server error occurred. Please try again later.',
      },
    },
    500,
  );
}

// Register in index.ts
app.onError(errorHandler);
// #endbook

// Your Hono instance
declare const app: Hono;
