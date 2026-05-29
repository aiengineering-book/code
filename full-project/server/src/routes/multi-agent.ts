// #book-ref ch16-multi-agent-route

import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';
import { Orchestrator } from '../lib/agent/multi/orchestrator.js';
import { authMiddleware } from '../middleware/auth.js';

const RunSchema = z.object({
  goal: z.string().min(1).max(3000),
  maxConcurrency: z.number().int().min(1).max(5).default(3),
});

const multiAgentRouter = new Hono()
  .use('*', authMiddleware)

  .post('/orchestrate', zValidator('json', RunSchema), async (c) => {
    const { goal } = c.req.valid('json');

    return streamSSE(c, async (stream) => {
      const orchestrator = new Orchestrator({
        onProgress: async (event) => {
          await stream.writeSSE({
            event: event.type,
            data: JSON.stringify(event),
          });
        },
      });

      try {
        const { answer, plan, results } = await orchestrator.run(goal);

        // Aggregate results
        const summary = {
          answer,
          taskCount: plan.tasks.length,
          successCount: [...results.values()].filter(
            (r) => r.status === 'success',
          ).length,
          totalDurationMs: [...results.values()].reduce(
            (s, r) => s + r.durationMs,
            0,
          ),
        };

        await stream.writeSSE({
          event: 'result',
          data: JSON.stringify(summary),
        });
      } catch (error) {
        await stream.writeSSE({
          event: 'error',
          data: JSON.stringify({
            message: error instanceof Error ? error.message : 'Unknown error',
          }),
        });
      }
    });
  });

export default multiAgentRouter;
// #endbook-ref
