// ch14-tool-calling/server/src/lib/agent/tool-observer.ts
// #book ch14-tool-observer
// ch14-tool-calling/server/src/lib/agent/tool-observer.ts

import { sql } from 'drizzle-orm';
import { db } from '../../database/client.js';

export interface ToolCallLog {
  agentRunId: string;
  userId: string;
  toolName: string;
  input: Record<string, unknown>;
  output: string;
  success: boolean;
  durationMs: number;
  step: number;
}

export async function logToolCall(log: ToolCallLog): Promise<void> {
  try {
    // Write to the tool call log table (table must be created first)
    await db.execute(sql`
      INSERT INTO tool_call_logs
        (agent_run_id, user_id, tool_name, input, output, success, duration_ms, step, created_at)
      VALUES
        (${log.agentRunId}, ${log.userId}, ${log.toolName},
         ${JSON.stringify(log.input)}, ${log.output.slice(0, 5000)},
         ${log.success}, ${log.durationMs}, ${log.step}, NOW())
    `);
  } catch (error) {
    // Log write failure must not affect the main request path
    console.error('[ToolObserver] Log write failed:', error);
  }
}

// Query tool call statistics (for monitoring dashboard)
export async function getToolStats(userId: string, days = 7) {
  const safeDays = Math.max(1, Math.min(365, Math.floor(Number(days))));
  const result = await db.execute(sql`
    SELECT
      tool_name,
      COUNT(*) as call_count,
      AVG(duration_ms) as avg_duration_ms,
      SUM(CASE WHEN success THEN 1 ELSE 0 END)::float / COUNT(*) as success_rate
    FROM tool_call_logs
    WHERE user_id = ${userId}
      AND created_at > NOW() - INTERVAL '1 day' * ${safeDays}
    GROUP BY tool_name
    ORDER BY call_count DESC
  `);

  // db.execute returns a postgres.js RowList (which is already an array)
  return Array.from(result);
}
// #endbook
