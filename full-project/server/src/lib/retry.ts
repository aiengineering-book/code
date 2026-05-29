// #book-ref ch12-production-rag/server/src/lib/retry.ts
import OpenAI from 'openai';

export interface RetryOptions {
  maxAttempts?: number; // 最大尝试次数（含第一次）
  initialDelay?: number; // 第一次重试前等待的毫秒数
  maxDelay?: number; // 等待时间上限
  backoffMultiplier?: number; // 退避倍数（通常是 2）
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

      // 优先用服务端告诉我们的等待时间
      const waitMs = getRetryAfterMs(error) ?? Math.min(delay, maxDelay);

      console.warn(
        `[withRetry] 第 ${attempt} 次失败，${waitMs}ms 后重试:`,
        error instanceof Error ? error.message : error,
      );

      await new Promise((r) => setTimeout(r, waitMs));
      delay = Math.min(delay * backoffMultiplier, maxDelay); // 下次等更长
    }
  }

  // TypeScript 需要这行，实际上不会执行到这里
  throw new Error('unreachable');
}
