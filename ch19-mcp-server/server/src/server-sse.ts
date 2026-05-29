// #book ch19-server-sse
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
// ch19-mcp-server/server/src/server-sse.ts
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';
import { registerPromptHandlers } from './handlers/prompts.js';
import { registerResourceHandlers } from './handlers/resources.js';
import { registerToolHandlers } from './handlers/tools.js';

const app = express();
app.use(express.json());

// 存放所有活跃会话：sessionId → { transport, server }
// MCP 协议是有状态的——initialize 之后的请求（list tools、call tool 等）
// 必须路由到同一个 transport 实例，否则 transport 会因为"未初始化"而拒绝请求。
const sessions = new Map<
  string,
  {
    transport: StreamableHTTPServerTransport;
    server: McpServer;
  }
>();

app.post('/mcp', async (req, res) => {
  // 检查请求头里有没有 sessionId：有就说明是已有会话的后续请求
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (sessionId && sessions.has(sessionId)) {
    // 已有会话：取出对应的 transport 处理请求
    const { transport } = sessions.get(sessionId)!;
    await transport.handleRequest(req, res, req.body);
    return;
  }

  // 新会话（initialize 请求）：创建 server 和 transport
  const server = new McpServer({ name: 'ts-ai-mcp-server', version: '1.0.0' });

  registerToolHandlers(server);
  registerResourceHandlers(server);
  registerPromptHandlers(server);

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
    onsessioninitialized: (id) => {
      // sessionId 生成后存入 Map，后续请求就能找到同一个 transport
      sessions.set(id, { transport, server });
    },
  });

  // onclose 在 connect 之前赋值，避免极端情况下的竞态
  transport.onclose = () => {
    const id = transport.sessionId;
    if (id && sessions.has(id)) {
      const session = sessions.get(id)!;
      // server 也要关闭，释放内部 listeners 和注册信息
      void session.server.close();
      sessions.delete(id);
    }
  };

  await server.connect(transport as any);
  await transport.handleRequest(req, res, req.body);
});

const PORT = process.env.MCP_PORT ?? 3001;
app.listen(PORT, () => {
  console.error(`MCP Streamable HTTP Server 启动在端口 ${PORT}`);
});
// #endbook
