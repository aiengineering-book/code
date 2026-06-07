// #book ch21-db-mcp
// ch21-mcp-publish/db-mcp/src/index.ts

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import postgres from 'postgres';
import { z } from 'zod';
import { env } from './env.js';

const sql = postgres(env.DATABASE_URL, { max: 3 });

const server = new McpServer({ name: 'db-mcp', version: '1.0.0' });

// Only allow SELECT statements
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
  'Execute a read-only SQL query (only SELECT and EXPLAIN are allowed)',
  {
    sql: z.string().min(1).describe('SQL query statement (SELECT only)'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(500)
      .default(50)
      .describe('Row limit for results, default 50'),
  },
  async ({ sql: query, limit }) => {
    if (!isSelectOnly(query)) {
      return {
        content: [
          { type: 'text' as const, text: 'Only SELECT queries are allowed' },
        ],
        isError: true,
      };
    }

    try {
      // Add LIMIT to prevent full table scans
      const limitedQuery = query.trimEnd().endsWith(';')
        ? query.trimEnd().slice(0, -1)
        : query;
      const safeQuery = `SELECT * FROM (${limitedQuery}) AS _q LIMIT ${limit}`;

      const rows = await sql.unsafe(safeQuery);

      if (rows.length === 0)
        return {
          content: [
            { type: 'text' as const, text: 'Query returned no results' },
          ],
        };

      // Format as table
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
            text: `Query results (${rows.length} rows):\n\n${table}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `SQL execution failed: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  },
);

server.tool(
  'db_schema',
  'View database table structure',
  {
    tableName: z
      .string()
      .optional()
      .describe('Table name (leave empty to list all tables)'),
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
          {
            type: 'text' as const,
            text: `Structure of table ${tableName}:\n${text}`,
          },
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
      content: [
        { type: 'text' as const, text: `Tables in database:\n${text}` },
      ],
    };
  },
);

server.tool(
  'db_explain',
  'Analyze the execution plan of a SQL query',
  {
    sql: z.string().min(1).describe('The SQL statement to analyze'),
  },
  async ({ sql: query }) => {
    if (!isSelectOnly(query)) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'EXPLAIN only supports SELECT queries',
          },
        ],
        isError: true,
      };
    }

    const plan = await sql.unsafe(`EXPLAIN ANALYZE ${query}`);
    const text = plan.map((row) => Object.values(row as object)[0]).join('\n');
    return {
      content: [{ type: 'text' as const, text: `Execution plan:\n${text}` }],
    };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error('✅ DB MCP Server started');
// #endbook
