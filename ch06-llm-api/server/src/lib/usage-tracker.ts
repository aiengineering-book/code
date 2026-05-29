// #book ch06-usage-tracker
// ch06-llm-api/server/src/lib/usage-tracker.ts
import { db } from '../database/client.js';
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
      costUsd: record.costUsd.toString(), // numeric column requires string input
    });
  } catch (error) {
    // Tracking failures must not affect the main request path
    console.error('[trackUsage] Failed to record usage:', error);
  }
}
// #endbook
