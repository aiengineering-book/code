import 'dotenv/config';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { mcpManager } from './lib/mcp/manager.js';
import mcpRouter from './routes/mcp.js';

// 从配置文件加载 MCP Server 列表
const MCP_SERVERS = [
  // 你在第 19 章构建的知识库 MCP Server
  {
    name: 'knowledge-base',
    command: 'node',
    // args: ['../../ch19-mcp-server/server/dist/index.js'],
    args: ['packages/mcp-server/dist/index.js'],
  },
  // 官方 GitHub MCP Server（如果已安装）
  // {
  //   name: 'github',
  //   command: 'npx',
  //   args: ['-y', '@modelcontextprotocol/server-github'],
  //   env: { GITHUB_PERSONAL_ACCESS_TOKEN: process.env.GITHUB_TOKEN ?? '' },
  // },
];

const app = new Hono();
app.use('*', cors());

// 注册路由
app.route('/api/mcp', mcpRouter);

// 异步初始化（不阻塞服务启动）
mcpManager
  .loadFromConfig(MCP_SERVERS)
  .then(() => {
    console.log('[MCP] 所有 Server 初始化完成');
  })
  .catch((err: unknown) => {
    console.error('[MCP] 初始化失败：', err);
  });

// 进程退出时断开所有 MCP 连接
process.on('SIGTERM', async () => {
  await mcpManager.disconnectAll();
  process.exit(0);
});

const port = Number(process.env.PORT ?? 3000);
serve({ fetch: app.fetch, port }, () => {
  console.log(`Server running on http://localhost:${port}`);
});
