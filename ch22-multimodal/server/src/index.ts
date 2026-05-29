import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { env } from './env.js';
import speechRouter from './routes/speech.js';
import ttsRouter from './routes/tts.js';
import visionRouter from './routes/vision.js';

const app = new Hono();

app.route('/api/vision', visionRouter);
app.route('/api/speech', speechRouter);
app.route('/api/tts', ttsRouter);

app.get('/health', (c) => c.json({ status: 'ok' }));

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(
    `ch22-multimodal server running on http://localhost:${info.port}`,
  );
});
