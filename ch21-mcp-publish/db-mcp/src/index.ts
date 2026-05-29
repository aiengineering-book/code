// #book ch21-db-mcp

// ch21-mcp-publish/db-mcp/src/index.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import postgres from 'postgres';
import { z } from 'zod';
import { env } from './env.js';

const sql = postgres(env.DATABASE_URL, { max: 3 });

const server = new McpServer({ name: 'db-mcp', version: '1.0.0' });

// 只允许 SELECT 语句
function isSelectOnly(query: string): boolean {
  const normalized = query.trim().toLowerCase();
  return (
    normalized.startsWith('select') ||
    normalized.startsWith('with') || // CTE
    normalized.startsWith('explain')
  );
}

server.tool(
  'db_query',
  '执行只读 SQL 查询（只允许 SELECT 和 EXPLAIN）',
  {
    sql: z.string().min(1).describe('SQL 查询语句（只允许 SELECT）'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(500)
      .default(50)
      .describe('结果行数限制，默认 50'),
  },
  async ({ sql: query, limit }) => {
    if (!isSelectOnly(query)) {
      return {
        content: [{ type: 'text' as const, text: '只允许执行 SELECT 查询' }],
        isError: true,
      };
    }

    try {
      // 添加 LIMIT 防止全表扫描
      const limitedQuery = query.trimEnd().endsWith(';')
        ? query.trimEnd().slice(0, -1)
        : query;
      const safeQuery = `SELECT * FROM (${limitedQuery}) AS _q LIMIT ${limit}`;

      const rows = await sql.unsafe(safeQuery);

      if (rows.length === 0)
        return { content: [{ type: 'text' as const, text: '查询结果为空' }] };

      // 格式化为表格
      const headers = Object.keys(rows[0] as object);
      const table = [
        headers.join(' | '),
        headers.map(() => '---').join(' | '),
        ...rows.map((row) =>
          headers
            .map((h) => String((row as Record<string, unknown>)[h] ?? ''))
            .join(' | '),
        ),
      ].join('\n');

      return {
        content: [
          {
            type: 'text' as const,
            text: `查询结果（${rows.length} 行）：\n\n${table}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `SQL 执行失败：${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  },
);

server.tool(
  'db_schema',
  '查看数据库表结构',
  {
    tableName: z.string().optional().describe('表名（留空则列出所有表）'),
  },
  async ({ tableName }) => {
    if (tableName) {
      const columns = await sql`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = ${tableName}
        ORDER BY ordinal_position
      `;
      const text = columns
        .map(
          (c) =>
            `  ${c.column_name}: ${c.data_type}${c.is_nullable === 'NO' ? ' NOT NULL' : ''}${c.column_default ? ` DEFAULT ${c.column_default}` : ''}`,
        )
        .join('\n');
      return {
        content: [
          { type: 'text' as const, text: `表 ${tableName} 的结构：\n${text}` },
        ],
      };
    }

    const tables = await sql`
      SELECT table_name, table_type
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    const text = tables
      .map((t) => `  ${t.table_name} (${t.table_type})`)
      .join('\n');
    return {
      content: [{ type: 'text' as const, text: `数据库中的表：\n${text}` }],
    };
  },
);

server.tool(
  'db_explain',
  '分析 SQL 查询的执行计划',
  {
    sql: z.string().min(1).describe('要分析的 SQL 语句'),
  },
  async ({ sql: query }) => {
    if (!isSelectOnly(query)) {
      return {
        content: [
          { type: 'text' as const, text: 'EXPLAIN 只允许分析 SELECT 查询' },
        ],
        isError: true,
      };
    }

    const plan = await sql.unsafe(`EXPLAIN ANALYZE ${query}`);
    const text = plan.map((row) => Object.values(row as object)[0]).join('\n');
    return {
      content: [{ type: 'text' as const, text: `执行计划：\n${text}` }],
    };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error('✅ DB MCP Server 已启动');
// #endbook
