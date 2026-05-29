// #book ch06-usage-tracker
import { db } from '../database/client.js';
// ch06-llm-api/server/src/lib/usage-tracker.ts
import { usageLogs } from '../database/schema.js';

export async function trackUsage(record: {
  userId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  endpoint: string;
}): Promise<void> {
  try {
    await db.insert(usageLogs).values({
      ...record,
      costUsd: record.costUsd.toString(), // numeric 列需要传字符串
    });
  } catch (error) {
    // 记录失败不能影响主流程
    console.error('[trackUsage] 记录失败:', error);
  }
}
// #endbook
