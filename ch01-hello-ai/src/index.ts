// #book ch01-hello-ai
import { serve } from '@hono/node-server';
// ch01-hello-ai/src/index.ts
import { Hono } from 'hono';
import OpenAI from 'openai';

const app = new Hono();
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post('/chat', async (c) => {
  const { message } = await c.req.json();

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    max_completion_tokens: 1024,
    messages: [{ role: 'user', content: message }],
  });

  return c.json({ reply: response.choices[0].message.content });
});

serve({ fetch: app.fetch, port: 3000 }, () => {
  console.log('🚀 Server running at http://localhost:3000');
});
// #endbook
