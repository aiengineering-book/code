// #book ch19-index
// ch19-mcp-server/server/src/index.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerPromptHandlers } from './handlers/prompts.js';
import { registerResourceHandlers } from './handlers/resources.js';
import { registerToolHandlers } from './handlers/tools.js';

const server = new McpServer({ name: 'ts-ai-mcp-server', version: '1.0.0' });

// Register all handlers
registerToolHandlers(server);
registerResourceHandlers(server);
registerPromptHandlers(server);

// Log unhandled errors
server.server.onerror = (error) => {
  console.error('[MCP Server Error]', error);
};

// Start (stdio transport)
const transport = new StdioServerTransport();
await server.connect(transport);

console.error('✅ ts-ai-mcp-server started (stdio transport)');

// Keep the process alive
process.on('SIGINT', async () => {
  console.error('SIGINT received, shutting down...');
  await server.close();
  process.exit(0);
});
// #endbook
