import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { env } from './env.js';
import chatbotRouter from './routes/chatbot.js';

const app = new Hono().route('/api/chatbot', chatbotRouter);

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`Server running at http://localhost:${info.port}`);
});

export default app;
