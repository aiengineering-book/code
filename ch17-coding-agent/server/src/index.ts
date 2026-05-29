import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { env } from './env.js';
import codeReviewRouter from './routes/code-review.js';

const app = new Hono();

app.route('/api/code-review', codeReviewRouter);

app.get('/health', (c) => c.json({ status: 'ok' }));

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(
    `ch17-coding-agent server running on http://localhost:${info.port}`,
  );
});
