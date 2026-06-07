import Anthropic from '@anthropic-ai/sdk';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const app = new Hono();

app.post('/chat', async (c) => {
  const { message } = await c.req.json();

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: message }],
  });

  const reply = response.content[0];
  if (reply.type !== 'text') {
    return c.json({ error: 'Unexpected response type' }, 500);
  }
  return c.json({ reply: reply.text });
});

serve({ fetch: app.fetch, port: 3000 }, () => {
  console.log('🚀 Server running at http://localhost:3000');
});
