// #book ch24-collaboration-route
// full-project/server/src/routes/collaboration.ts

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

  // Create a collaboration Agent session
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

      // Run Agent in the background (does not block the response)
      runAgentInBackground(sessionId, userId, task);

      return c.json({ sessionId });
    },
  )

  // SSE: subscribe to real-time updates for a collaboration session
  .get('/sessions/:sessionId/stream', async (c) => {
    const userId = c.get('userId');
    const { sessionId } = c.req.param();

    // Join the session
    const session = collaborationService.joinSession(sessionId, userId);
    if (!session) return c.json({ error: 'Session not found' }, 404);

    return streamSSE(c, async (stream) => {
      // Send existing steps (replay history)
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

      // Subscribe to subsequent events
      const unsubscribe = collaborationService.subscribe(
        sessionId,
        async (event) => {
          await stream.writeSSE({
            event: (event as { type: string }).type,
            data: JSON.stringify(event),
          });
        },
      );

      // Wait for the connection to close
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
      message: error instanceof Error ? error.message : 'Execution failed',
    });
  }
}

export default collaborationRouter;
// #endbook
