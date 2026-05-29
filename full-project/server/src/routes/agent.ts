// #book ch24-agent-route

import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';
import { ReActAgent } from '../lib/agent/react-agent.js';
import { getToolsForRole } from '../lib/agent/tools/index.js';
import { authMiddleware } from '../middleware/auth.js';

type Env = { Variables: { userId: string } };

const agentRouter = new Hono<Env>()
  .use('*', authMiddleware)

  // 单次 Agent 任务（流式）
  .post(
    '/run',
    zValidator(
      'json',
      z.object({
        task: z.string().min(1).max(5000),
        maxSteps: z.number().int().min(1).max(30).default(10),
      }),
    ),
    async (c) => {
      const { task, maxSteps } = c.req.valid('json');

      return streamSSE(c, async (stream) => {
        const agent = new ReActAgent({
          tools: getToolsForRole('editor'),
          maxSteps,
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

export default agentRouter;
// #endbook
