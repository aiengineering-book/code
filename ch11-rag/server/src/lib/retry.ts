// #book-ref ch10-ingestion/server/src/lib/retry.ts
import OpenAI from 'openai';

export interface RetryOptions {
  maxAttempts?: number; // Max attempts (including the first)
  initialDelay?: number; // Milliseconds to wait before the first retry
  maxDelay?: number; // Upper bound on wait time
  backoffMultiplier?: number; // Backoff multiplier (usually 2)
}

function isRetryable(error: unknown): boolean {
  if (error instanceof OpenAI.RateLimitError) return true;
  if (error instanceof OpenAI.InternalServerError) return true;
  if (error instanceof OpenAI.APIConnectionError) return true;
  if (error instanceof OpenAI.APIConnectionTimeoutError) return true;
  return false;
}

function getRetryAfterMs(error: unknown): number | null {
  if (error instanceof OpenAI.RateLimitError) {
    const headers = error.headers;
    if (headers) {
      const retryAfter = headers.get('retry-after');
      if (retryAfter) return Number(retryAfter) * 1000;
    }
  }
  return null;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 30_000,
    backoffMultiplier = 2,
  } = options;

  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isLast = attempt === maxAttempts;
      if (isLast || !isRetryable(error)) throw error;

      // Prefer the wait time provided by the server
      const waitMs = getRetryAfterMs(error) ?? Math.min(delay, maxDelay);

      console.warn(
        `[withRetry] attempt ${attempt} failed, retrying in ${waitMs}ms:`,
        error instanceof Error ? error.message : error,
      );

      await new Promise((r) => setTimeout(r, waitMs));
      delay = Math.min(delay * backoffMultiplier, maxDelay); // wait longer next time
    }
  }

  // TypeScript requires this line; it is never actually reached
  throw new Error('unreachable');
}
