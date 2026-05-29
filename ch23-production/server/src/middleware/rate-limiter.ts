// #book ch23-rate-limiter
// ch23-production/server/src/middleware/rate-limiter.ts

import { and, eq, gte, sum } from 'drizzle-orm';
import { db } from '../database/client.js';
import { usageLogs } from '../database/schema.js';
import { RateLimitError } from '../errors.js';

// Rate limit rule
interface RateLimitRule {
  windowMs: number; // Time window (milliseconds)
  maxRequests: number; // Maximum number of requests
  maxTokens?: number; // Maximum token count (optional)
}

// Rate limit rules by user tier
const RATE_LIMIT_RULES: Record<string, RateLimitRule[]> = {
  free: [
    { windowMs: 60_000, maxRequests: 10 }, // 10 per minute
    { windowMs: 24 * 60 * 60 * 1000, maxRequests: 100, maxTokens: 100_000 }, // 100 per day
  ],
  pro: [
    { windowMs: 60_000, maxRequests: 60 }, // 60 per minute
    { windowMs: 24 * 60 * 60 * 1000, maxRequests: 2000, maxTokens: 2_000_000 }, // 2M tokens per day
  ],
  enterprise: [
    { windowMs: 60_000, maxRequests: 300 },
    { windowMs: 24 * 60 * 60 * 1000, maxRequests: 50_000 },
  ],
};

// In-memory counter (use Redis in production)
const requestCounts = new Map<string, { count: number; resetAt: number }>();

export async function checkRateLimit(
  userId: string,
  userTier: keyof typeof RATE_LIMIT_RULES = 'free',
  endpoint = 'api',
): Promise<void> {
  const rules = RATE_LIMIT_RULES[userTier] ?? RATE_LIMIT_RULES.free;

  for (const rule of rules!) {
    const key = `${userId}:${rule.windowMs}:${endpoint}`;
    const now = Date.now();

    let counter = requestCounts.get(key);
    if (!counter || counter.resetAt <= now) {
      counter = { count: 0, resetAt: now + rule.windowMs };
      requestCounts.set(key, counter);
    }

    if (counter.count >= rule.maxRequests) {
      const retryAfter = Math.ceil((counter.resetAt - now) / 1000);
      throw new RateLimitError(retryAfter);
    }

    counter.count++;

    // Check token quota (query from database)
    if (rule.maxTokens) {
      const windowStart = new Date(now - rule.windowMs);
      const result = await db
        .select({ total: sum(usageLogs.inputTokens) })
        .from(usageLogs)
        .where(
          and(
            eq(usageLogs.userId, userId),
            gte(usageLogs.createdAt, windowStart),
          ),
        )
        .limit(1);

      const usedTokens = Number(result[0]?.total ?? 0);
      if (usedTokens >= rule.maxTokens) {
        throw new RateLimitError(Math.ceil((counter.resetAt - now) / 1000));
      }
    }
  }
}

// Middleware
import type { MiddlewareHandler } from 'hono';

export function rateLimitMiddleware(endpoint?: string): MiddlewareHandler {
  return async (c, next) => {
    const userId = c.get('userId') as string;
    if (!userId) {
      await next();
      return;
    }

    // TODO: query tier from user table
    const userTier = 'free';

    await checkRateLimit(userId, userTier, endpoint);
    await next();
  };
}
// #endbook
