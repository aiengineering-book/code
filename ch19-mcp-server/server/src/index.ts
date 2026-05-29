// #book ch19-index
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
// ch19-mcp-server/server/src/index.ts
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerPromptHandlers } from './handlers/prompts.js';
import { registerResourceHandlers } from './handlers/resources.js';
import { registerToolHandlers } from './handlers/tools.js';

const server = new McpServer({ name: 'ts-ai-mcp-server', version: '1.0.0' });

// 注册所有处理器
registerToolHandlers(server);
registerResourceHandlers(server);
registerPromptHandlers(server);

// 未处理的错误日志
server.server.onerror = (error) => {
  console.error('[MCP Server Error]', error);
};

// 启动（stdio 传输）
const transport = new StdioServerTransport();
await server.connect(transport);

console.error('✅ ts-ai-mcp-server 已启动（stdio 传输）');

// 保持进程存活
process.on('SIGINT', async () => {
  console.error('收到 SIGINT，正在关闭...');
  await server.close();
  process.exit(0);
});
// #endbook
