// #book-ref ch23-rate-limiter

import { and, eq, gte, sum } from 'drizzle-orm';
import { db } from '../database/client.js';
import { usageLogs } from '../database/schema.js';
import { RateLimitError } from '../errors.js';

// 限流规则
interface RateLimitRule {
  windowMs: number; // 时间窗口（毫秒）
  maxRequests: number; // 最大请求数
  maxTokens?: number; // 最大 Token 数（可选）
}

// 不同用户等级的限流规则
const RATE_LIMIT_RULES: Record<string, RateLimitRule[]> = {
  free: [
    { windowMs: 60_000, maxRequests: 10 }, // 每分钟 10 次
    { windowMs: 24 * 60 * 60 * 1000, maxRequests: 100, maxTokens: 100_000 }, // 每天 100 次
  ],
  pro: [
    { windowMs: 60_000, maxRequests: 60 }, // 每分钟 60 次
    { windowMs: 24 * 60 * 60 * 1000, maxRequests: 2000, maxTokens: 2_000_000 }, // 每天 200 万 Token
  ],
  enterprise: [
    { windowMs: 60_000, maxRequests: 300 },
    { windowMs: 24 * 60 * 60 * 1000, maxRequests: 50_000 },
  ],
};

// 内存计数器（生产环境应使用 Redis）
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

    // 检查 Token 配额（从数据库查询）
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

// 中间件
import type { MiddlewareHandler } from 'hono';

export function rateLimitMiddleware(endpoint?: string): MiddlewareHandler {
  return async (c, next) => {
    const userId = c.get('userId') as string;
    if (!userId) {
      await next();
      return;
    }

    // TODO: 从用户表查询 tier
    const userTier = 'free';

    await checkRateLimit(userId, userTier, endpoint);
    await next();
  };
}
// #endbook-ref
