// #book-ref ch20-mcp-route

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

  // 获取所有已连接 Server 的状态
  .get('/status', (c) => {
    return c.json(mcpManager.getStatus());
  })

  // 获取所有可用工具列表
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

  // 直接调用 MCP 工具（不经过 Agent）
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

  // 通过 MCP 工具运行 Agent（流式）
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
        // 获取 MCP 工具并转换为 Agent 可用格式
        let managedTools = mcpManager.getAllTools();
        if (serverFilter?.length) {
          managedTools = managedTools.filter((t) =>
            serverFilter.includes(t.serverName),
          );
        }

        const agentTools = adaptMCPToolsForAgent(managedTools, {
          userRole: 'editor',
          onPermissionDenied: (toolName, reason) => {
            console.warn(`[MCP] 工具 ${toolName} 被拒绝：${reason}`);
          },
          onConfirmationRequired: async (toolName, args, reason) => {
            // 向前端发送确认请求事件
            await stream.writeSSE({
              event: 'confirmation_required',
              data: JSON.stringify({ toolName, args, reason }),
            });

            // 等待前端确认（简化实现：默认允许）
            // 生产环境应该等待前端的 WebSocket 确认消息
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
              message: error instanceof Error ? error.message : '执行失败',
            }),
          });
        }
      });
    },
  );

export default mcpRouter;
// #endbook-ref
