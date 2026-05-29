import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { env } from './env.js';
import multiAgentRouter from './routes/multi-agent.js';

const app = new Hono();

app.route('/api/multi-agent', multiAgentRouter);

app.get('/health', (c) => c.json({ status: 'ok' }));

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(
    `ch16-multi-agent server running on http://localhost:${info.port}`,
  );
});
