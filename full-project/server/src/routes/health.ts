// #book ch24-health-route
// full-project/server/src/routes/health.ts

import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { db } from '../database/client.js';
import { mcpManager } from '../lib/mcp/manager.js';

const healthRouter = new Hono().get('/', async (c) => {
  const checks = await Promise.allSettled([
    // Database connection
    db.execute(sql`SELECT 1`).then(() => ({ name: 'database', status: 'ok' })),
    // pgvector extension
    db
      .execute(sql`SELECT extname FROM pg_extension WHERE extname = 'vector'`)
      .then((r) => ({
        name: 'pgvector',
        status: (r as any[]).length > 0 ? 'ok' : 'missing',
      })),
  ]);

  const results = checks.map((r) =>
    r.status === 'fulfilled'
      ? r.value
      : { name: 'unknown', status: 'error', error: String(r.reason) },
  );

  const mcpStatus = mcpManager.getStatus();
  const allOk = results.every((r) => r.status === 'ok');

  return c.json(
    {
      status: allOk ? 'ok' : 'degraded',
      version: process.env.npm_package_version ?? '1.0.0',
      uptime: Math.floor(process.uptime()),
      checks: results,
      mcp: mcpStatus.map((s) => ({ name: s.name, connected: s.connected })),
      memory: {
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      },
    },
    allOk ? 200 : 207,
  );
});

export default healthRouter;
// #endbook
