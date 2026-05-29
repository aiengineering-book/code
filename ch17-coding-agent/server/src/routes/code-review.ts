// #book ch17-code-review-route

// ch17-coding-agent/server/src/routes/code-review.ts
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { autoFixTests } from '../services/auto-fix-service.js';
import { codeReviewService } from '../services/code-review-service.js';

const ReviewSchema = z.object({
  repoPath: z.string().min(1),
  targetBranch: z.string().default('main'),
  sourceBranch: z.string().default('HEAD'),
  focusAreas: z.array(z.string()).default([]),
});

const codeReviewRouter = new Hono()
  .use('*', authMiddleware)

  // 流式代码审查
  .post('/review', zValidator('json', ReviewSchema), async (c) => {
    const params = c.req.valid('json');

    return streamSSE(c, async (stream) => {
      try {
        const review = await codeReviewService.review(params, async (step) => {
          await stream.writeSSE({
            event: 'progress',
            data: JSON.stringify({ message: step }),
          });
        });

        await stream.writeSSE({
          event: 'result',
          data: JSON.stringify(review),
        });
      } catch (error) {
        await stream.writeSSE({
          event: 'error',
          data: JSON.stringify({
            message: error instanceof Error ? error.message : '审查失败',
          }),
        });
      }
    });
  })

  // 自动修复测试
  .post(
    '/auto-fix',
    zValidator(
      'json',
      z.object({
        repoPath: z.string().min(1),
        testPattern: z.string().optional(),
      }),
    ),
    async (c) => {
      const { repoPath, testPattern } = c.req.valid('json');

      return streamSSE(c, async (stream) => {
        const result = await autoFixTests(
          repoPath,
          testPattern,
          async (message) => {
            await stream.writeSSE({
              event: 'progress',
              data: JSON.stringify({ message }),
            });
          },
        );

        await stream.writeSSE({
          event: 'result',
          data: JSON.stringify(result),
        });
      });
    },
  );

export default codeReviewRouter;
// #endbook
