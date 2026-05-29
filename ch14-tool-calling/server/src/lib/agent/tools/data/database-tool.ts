// packages/server/src/lib/agent/tools/data/database-tool.ts
// #book ch14-database-tool

// ch14-tool-calling/server/src/lib/agent/tools/data/database-tool.ts
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../../../database/client.js';

// 只允许 SELECT 查询，防止 Agent 意外修改数据
const ALLOWED_KEYWORDS = ['SELECT', 'WITH', 'EXPLAIN'];
const FORBIDDEN_KEYWORDS = [
  'INSERT',
  'UPDATE',
  'DELETE',
  'DROP',
  'CREATE',
  'ALTER',
  'TRUNCATE',
];

function validateQuery(query: string): void {
  const upperQuery = query.trim().toUpperCase();

  for (const keyword of FORBIDDEN_KEYWORDS) {
    if (upperQuery.includes(keyword)) {
      throw new Error(`不允许的操作：${keyword}。只支持 SELECT 查询`);
    }
  }

  const firstWord = upperQuery.split(/\s+/)[0];
  if (!firstWord || !ALLOWED_KEYWORDS.includes(firstWord)) {
    throw new Error(`查询必须以 SELECT 或 WITH 开头`);
  }
}

const DBQueryInput = z.object({
  query: z.string().min(1).max(2000),
  maxRows: z.number().int().min(1).max(100).default(20),
});

export const databaseQueryTool = {
  name: 'query_database',
  description: `执行只读的 SQL SELECT 查询，获取数据库中的数据。
只支持 SELECT 查询，不支持 INSERT/UPDATE/DELETE 等写操作。
返回最多 100 行结果。
可用的表：users（用户）、todos（待办）、conversations（对话）、documents（文档）、usage_logs（用量日志）`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'SQL SELECT 查询语句',
      },
      maxRows: {
        type: 'number',
        description: '最多返回行数，默认 20，最大 100',
      },
    },
    required: ['query'],
  },
  execute: async (input: Record<string, unknown>): Promise<string> => {
    const parsed = DBQueryInput.safeParse(input);
    if (!parsed.success) {
      return JSON.stringify({ error: '参数错误' });
    }

    const { query, maxRows } = parsed.data;

    try {
      validateQuery(query);

      // 添加 LIMIT 防止返回过多数据
      const limitedQuery = query.replace(/;?\s*$/, ` LIMIT ${maxRows}`);

      // db.execute 返回 postgres.js 的 RowList（本身就是数组）
      const result = await db.execute(sql.raw(limitedQuery));
      const rows = Array.from(result);

      return JSON.stringify({
        success: true,
        data: {
          rows,
          rowCount: rows.length,
          truncated: rows.length >= maxRows,
        },
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : '查询失败',
      });
    }
  },
};
// #endbook
