// #book ch19-server-sse
// ch19-mcp-server/server/src/server-sse.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';
import { registerPromptHandlers } from './handlers/prompts.js';
import { registerResourceHandlers } from './handlers/resources.js';
import { registerToolHandlers } from './handlers/tools.js';

const app = express();
app.use(express.json());

// Store all active sessions: sessionId → { transport, server }
// MCP protocol is stateful — requests after initialize (list tools, call tool, etc.)
// must be routed to the same transport instance, otherwise the transport will reject
// the request as "not initialized."
const sessions = new Map<
  string,
  {
    transport: StreamableHTTPServerTransport;
    server: McpServer;
  }
>();

app.post('/mcp', async (req, res) => {
  // Check if the request header contains a sessionId — if so, it's a follow-up to an existing session
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (sessionId && sessions.has(sessionId)) {
    // Existing session: retrieve the corresponding transport to handle the request
    const { transport } = sessions.get(sessionId)!;
    await transport.handleRequest(req, res, req.body);
    return;
  }

  // New session (initialize request): create server and transport
  const server = new McpServer({ name: 'ts-ai-mcp-server', version: '1.0.0' });

  registerToolHandlers(server);
  registerResourceHandlers(server);
  registerPromptHandlers(server);

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
    onsessioninitialized: (id) => {
      // Store in Map after sessionId is generated so subsequent requests can find the same transport
      sessions.set(id, { transport, server });
    },
  });

  // Assign onclose before connect to avoid race conditions in edge cases
  transport.onclose = () => {
    const id = transport.sessionId;
    if (id && sessions.has(id)) {
      const session = sessions.get(id)!;
      // Close the server too to release internal listeners and registrations
      void session.server.close();
      sessions.delete(id);
    }
  };

  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

const PORT = process.env.MCP_PORT ?? 3001;
app.listen(PORT, () => {
  console.error(`MCP Streamable HTTP Server started on port ${PORT}`);
});
// #endbook
