// packages/server/src/lib/agent/tools/data/database-tool.ts
// #book ch14-database-tool
// ch14-tool-calling/server/src/lib/agent/tools/data/database-tool.ts

import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../../../database/client.js';

// Only SELECT queries — prevent the Agent from accidentally modifying data
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
      throw new Error(`Operation not allowed: ${keyword}. Only SELECT queries are supported.`);
    }
  }

  const firstWord = upperQuery.split(/\s+/)[0];
  if (!firstWord || !ALLOWED_KEYWORDS.includes(firstWord)) {
    throw new Error(`Query must start with SELECT or WITH`);
  }
}

const DBQueryInput = z.object({
  query: z.string().min(1).max(2000),
  maxRows: z.number().int().min(1).max(100).default(20),
});

export const databaseQueryTool = {
  name: 'query_database',
  description: `Execute a read-only SQL SELECT query to retrieve data from the database.
Only SELECT queries are supported — no INSERT/UPDATE/DELETE or other write operations.
Returns up to 100 rows.
Available tables: users, todos, conversations, documents, usage_logs`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'SQL SELECT query',
      },
      maxRows: {
        type: 'number',
        description: 'Maximum rows to return, default 20, max 100',
      },
    },
    required: ['query'],
  },
  execute: async (input: Record<string, unknown>): Promise<string> => {
    const parsed = DBQueryInput.safeParse(input);
    if (!parsed.success) {
      return JSON.stringify({ error: 'Invalid parameters' });
    }

    const { query, maxRows } = parsed.data;

    try {
      validateQuery(query);

      // Append LIMIT to prevent excessive data return
      const limitedQuery = query.replace(/;?\s*$/, ` LIMIT ${maxRows}`);

      // db.execute returns a postgres.js RowList (which is already an array)
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
        error: error instanceof Error ? error.message : 'Query failed',
      });
    }
  },
};
// #endbook
