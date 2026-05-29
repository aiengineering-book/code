// #book ch24-collaboration-route

import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';
import { ReActAgent } from '../lib/agent/react-agent.js';
import { getToolsForRole } from '../lib/agent/tools/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { collaborationService } from '../services/collaboration-service.js';

type Env = { Variables: { userId: string } };

const collaborationRouter = new Hono<Env>()
  .use('*', authMiddleware)

  // 创建协作 Agent 会话
  .post(
    '/sessions',
    zValidator(
      'json',
      z.object({
        task: z.string().min(1).max(3000),
        shareWithTeam: z.boolean().default(false),
      }),
    ),
    async (c) => {
      const userId = c.get('userId');
      const { task } = c.req.valid('json');

      const sessionId = collaborationService.createSession(task, userId);

      // 在后台运行 Agent（不阻塞响应）
      runAgentInBackground(sessionId, userId, task);

      return c.json({ sessionId });
    },
  )

  // SSE：订阅协作会话的实时更新
  .get('/sessions/:sessionId/stream', async (c) => {
    const userId = c.get('userId');
    const { sessionId } = c.req.param();

    // 加入会话
    const session = collaborationService.joinSession(sessionId, userId);
    if (!session) return c.json({ error: '会话不存在' }, 404);

    return streamSSE(c, async (stream) => {
      // 发送当前已有的步骤（补播历史）
      for (const step of session.steps) {
        await stream.writeSSE({
          event: 'step',
          data: JSON.stringify(step),
        });
      }

      if (session.status === 'completed') {
        await stream.writeSSE({
          event: 'complete',
          data: JSON.stringify({ result: session.result }),
        });
        return;
      }

      // 订阅后续事件
      const unsubscribe = collaborationService.subscribe(
        sessionId,
        async (event) => {
          await stream.writeSSE({
            event: (event as { type: string }).type,
            data: JSON.stringify(event),
          });
        },
      );

      // 等待连接关闭
      await new Promise<void>((resolve) => {
        c.req.raw.signal.addEventListener('abort', () => {
          unsubscribe();
          resolve();
        });
      });
    });
  });

async function runAgentInBackground(
  sessionId: string,
  _userId: string,
  task: string,
): Promise<void> {
  const agent = new ReActAgent({
    tools: getToolsForRole('editor'),
    maxSteps: 12,
  });

  try {
    const result = await agent.run(task, {
      onStep: (step) => {
        collaborationService.addStep(sessionId, step);
      },
    });
    collaborationService.completeSession(sessionId, result.answer);
  } catch (error) {
    collaborationService.broadcast(sessionId, {
      type: 'error',
      message: error instanceof Error ? error.message : '执行失败',
    });
  }
}

export default collaborationRouter;
// #endbook
