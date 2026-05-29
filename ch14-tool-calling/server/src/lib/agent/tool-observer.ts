// packages/server/src/lib/agent/tool-observer.ts
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
    // 写入工具调用日志表（需要先创建表）
    await db.execute(sql`
      INSERT INTO tool_call_logs
        (agent_run_id, user_id, tool_name, input, output, success, duration_ms, step, created_at)
      VALUES
        (${log.agentRunId}, ${log.userId}, ${log.toolName},
         ${JSON.stringify(log.input)}, ${log.output.slice(0, 5000)},
         ${log.success}, ${log.durationMs}, ${log.step}, NOW())
    `);
  } catch (error) {
    // 日志写入失败不影响主流程
    console.error('[ToolObserver] 日志写入失败：', error);
  }
}

// 查询工具调用统计（用于监控面板）
export async function getToolStats(userId: string, days = 7) {
  const result = await db.execute(sql`
    SELECT
      tool_name,
      COUNT(*) as call_count,
      AVG(duration_ms) as avg_duration_ms,
      SUM(CASE WHEN success THEN 1 ELSE 0 END)::float / COUNT(*) as success_rate
    FROM tool_call_logs
    WHERE user_id = ${userId}
      AND created_at > NOW() - INTERVAL '${sql.raw(String(days))} days'
    GROUP BY tool_name
    ORDER BY call_count DESC
  `);

  // db.execute 返回 postgres.js 的 RowList（本身就是数组）
  return Array.from(result);
}
// #endbook
