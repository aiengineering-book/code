// #book ch20-mcp-route
// ch20-mcp-client/server/src/routes/mcp.ts

import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';
import { ReActAgent } from '../lib/agent/react-agent.js';
import { mcpManager } from '../lib/mcp/manager.js';
import { adaptMCPToolsForAgent } from '../lib/mcp/mcp-tool-adapter.js';
import { authMiddleware } from '../middleware/auth.js';

const mcpRouter = new Hono()
  .use('*', authMiddleware)

  // Get the status of all connected Servers
  .get('/status', (c) => {
    return c.json(mcpManager.getStatus());
  })

  // Get the list of all available tools
  .get('/tools', (c) => {
    const tools = mcpManager.getAllTools();
    return c.json(
      tools.map((t) => ({
        name: t.tool.name,
        description: t.tool.description,
        server: t.serverName,
      })),
    );
  })

  // Call an MCP tool directly (without going through the Agent)
  .post(
    '/tools/:toolName/call',
    zValidator(
      'json',
      z.object({
        args: z.record(z.unknown()).default({}),
      }),
    ),
    async (c) => {
      const { toolName } = c.req.param();
      const { args } = c.req.valid('json');

      const result = await mcpManager.callTool(toolName, args);
      return c.json({ result });
    },
  )

  // Run an Agent with MCP tools (streaming)
  .post(
    '/agent/run',
    zValidator(
      'json',
      z.object({
        task: z.string().min(1).max(3000),
        serverFilter: z.array(z.string()).optional(),
      }),
    ),
    async (c) => {
      const { task, serverFilter } = c.req.valid('json');

      return streamSSE(c, async (stream) => {
        // Get MCP tools and convert to Agent-compatible format
        let managedTools = mcpManager.getAllTools();
        if (serverFilter?.length) {
          managedTools = managedTools.filter((t) =>
            serverFilter.includes(t.serverName),
          );
        }

        const agentTools = adaptMCPToolsForAgent(managedTools, {
          userRole: 'editor',
          onPermissionDenied: (toolName, reason) => {
            console.warn(`[MCP] Tool ${toolName} denied: ${reason}`);
          },
          onConfirmationRequired: async (toolName, args, reason) => {
            // Send a confirmation-required event to the frontend
            await stream.writeSSE({
              event: 'confirmation_required',
              data: JSON.stringify({ toolName, args, reason }),
            });

            // Wait for frontend confirmation (simplified: allow by default)
            // In production, wait for a WebSocket confirmation message from the frontend
            return true;
          },
        });

        const agent = new ReActAgent({
          tools: agentTools,
          maxSteps: 10,
          onStep: async (step) => {
            await stream.writeSSE({
              event: 'step',
              data: JSON.stringify(step),
            });
          },
        });

        try {
          const result = await agent.run(task);
          await stream.writeSSE({
            event: 'done',
            data: JSON.stringify({ answer: result.answer }),
          });
        } catch (error) {
          await stream.writeSSE({
            event: 'error',
            data: JSON.stringify({
              message: error instanceof Error ? error.message : 'Execution failed',
            }),
          });
        }
      });
    },
  );

export default mcpRouter;
// #endbook
