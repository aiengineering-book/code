// #book ch03-timeout
// ch03-server-patterns/server/src/middleware/timeout.ts
import type { Hono, MiddlewareHandler } from 'hono';

declare module 'hono' {
  interface ContextVariableMap {
    abortSignal: AbortSignal;
  }
}

// Your Hono instance
declare const app: Hono;

export function timeout(ms: number): MiddlewareHandler {
  return async (c, next) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ms);

    // Place the signal in context for route handlers to use
    c.set('abortSignal', controller.signal);

    try {
      await next();
    } finally {
      clearTimeout(timeoutId);
    }
  };
}

// Using the abortSignal in a route
app.post('/api/chat', timeout(30_000), async (c) => {
  const signal = c.get('abortSignal') as AbortSignal;

  const response = await fetch(`${process.env.LLM_API_BASE}/v1/messages`, {
    method: 'POST',
    signal, // If timeout fires, fetch cancels and throws AbortError
    headers: {
      /* ... */
    },
    body: JSON.stringify({
      /* ... */
    }),
  });

  return response;
});
// #endbook
