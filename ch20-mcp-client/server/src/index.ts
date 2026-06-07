import 'dotenv/config';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { mcpManager } from './lib/mcp/manager.js';
import mcpRouter from './routes/mcp.js';

// Load MCP Server list from config
const MCP_SERVERS = [
  // The knowledge base MCP Server you built in Chapter 19
  {
    name: 'knowledge-base',
    command: 'node',
    // args: ['../../ch19-mcp-server/server/dist/index.js'],
    args: ['packages/mcp-server/dist/index.js'],
  },
  // Official GitHub MCP Server (if installed)
  // {
  //   name: 'github',
  //   command: 'npx',
  //   args: ['-y', '@modelcontextprotocol/server-github'],
  //   env: { GITHUB_PERSONAL_ACCESS_TOKEN: process.env.GITHUB_TOKEN ?? '' },
  // },
];

const app = new Hono();
app.use('*', cors());

// Register routes
app.route('/api/mcp', mcpRouter);

// Async initialization (does not block server startup)
mcpManager
  .loadFromConfig(MCP_SERVERS)
  .then(() => {
    console.log('[MCP] All Servers initialized');
  })
  .catch((err: unknown) => {
    console.error('[MCP] Initialization failed:', err);
  });

// Disconnect all MCP connections on process exit
process.on('SIGTERM', async () => {
  await mcpManager.disconnectAll();
  process.exit(0);
});

const port = Number(process.env.PORT ?? 3000);
serve({ fetch: app.fetch, port }, () => {
  console.log(`Server running on http://localhost:${port}`);
});
