// #book ch23-cost-monitor
// ch23-production/server/src/lib/cost-monitor.ts

import { gte, sum } from 'drizzle-orm';
import { db } from '../database/client.js';
import { usageLogs } from '../database/schema.js';

export interface CostReport {
  period: string;
  totalCostUsd: number;
  totalRequests: number;
  totalTokens: number;
  byUser: Array<{
    userId: string;
    costUsd: number;
    requests: number;
  }>;
  byEndpoint: Array<{
    endpoint: string;
    costUsd: number;
    requests: number;
  }>;
}

export async function generateCostReport(
  startDate: Date,
  endDate: Date,
): Promise<CostReport> {
  const logs = await db.query.usageLogs.findMany({
    where: (l, { and, gte, lte }) =>
      and(gte(l.createdAt, startDate), lte(l.createdAt, endDate)),
  });

  const totalCostUsd = logs.reduce((s, l) => s + Number(l.costUsd), 0);
  const totalTokens = logs.reduce(
    (s, l) => s + l.inputTokens + l.outputTokens,
    0,
  );

  // Aggregate by user
  const userMap = new Map<string, { cost: number; requests: number }>();
  for (const log of logs) {
    const existing = userMap.get(log.userId) ?? { cost: 0, requests: 0 };
    userMap.set(log.userId, {
      cost: existing.cost + Number(log.costUsd),
      requests: existing.requests + 1,
    });
  }

  // Aggregate by endpoint
  const endpointMap = new Map<string, { cost: number; requests: number }>();
  for (const log of logs) {
    const existing = endpointMap.get(log.endpoint) ?? { cost: 0, requests: 0 };
    endpointMap.set(log.endpoint, {
      cost: existing.cost + Number(log.costUsd),
      requests: existing.requests + 1,
    });
  }

  return {
    period: `${startDate.toISOString().split('T')[0]} ~ ${endDate.toISOString().split('T')[0]}`,
    totalCostUsd,
    totalRequests: logs.length,
    totalTokens,
    byUser: Array.from(userMap.entries())
      .map(([userId, data]) => ({
        userId,
        costUsd: data.cost,
        requests: data.requests,
      }))
      .sort((a, b) => b.costUsd - a.costUsd)
      .slice(0, 10),
    byEndpoint: Array.from(endpointMap.entries())
      .map(([endpoint, data]) => ({
        endpoint,
        costUsd: data.cost,
        requests: data.requests,
      }))
      .sort((a, b) => b.costUsd - a.costUsd),
  };
}

/**
 * Cost alert: send notification when today's cost exceeds threshold
 */
export async function checkCostAlert(
  alertThresholdUsd = 50,
): Promise<{ triggered: boolean; currentCostUsd: number }> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const result = await db
    .select({ total: sum(usageLogs.costUsd) })
    .from(usageLogs)
    .where(gte(usageLogs.createdAt, today));

  const currentCostUsd = Number(result[0]?.total ?? 0);

  if (currentCostUsd >= alertThresholdUsd) {
    // Send alert (e.g., email, Slack message)
    console.warn(
      `🚨 Cost alert: today's spend $${currentCostUsd.toFixed(2)} has exceeded threshold $${alertThresholdUsd}`,
    );
    // await sendSlackAlert(`Today's AI cost has reached $${currentCostUsd.toFixed(2)}`);
  }

  return { triggered: currentCostUsd >= alertThresholdUsd, currentCostUsd };
}
// #endbook
