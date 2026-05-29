import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { env } from './env.js';
import monitoringRouter from './routes/monitoring.js';

const app = new Hono();

app.route('/api/monitoring', monitoringRouter);
app.get('/health', (c) => c.json({ status: 'ok' }));

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(
    `ch23-production server running on http://localhost:${info.port}`,
  );
});
