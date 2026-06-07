// #book ch07-chat-route
// ch07-prompt-engineering/server/src/routes/chat.ts

import type { Hono } from 'hono';
import { callLLM } from '../lib/llm.js';
import {
  getPromptVariant,
  recordExperimentResult,
} from '../lib/prompt-ab-test.js';

// chatRouter is defined in your main router — this file shows the route handlers
declare const chatRouter: Hono;

chatRouter.post('/reply', async (c) => {
  const { userId, question } = await c.req.json();

  // 1. Assign a stable prompt variant for this user
  const { variant, prompt, version } = getPromptVariant(userId);

  // 2. Call the model, measure response time
  const start = Date.now();
  const { text } = await callLLM([{ role: 'user', content: question }], {
    system: prompt,
  });
  const responseTime = Date.now() - start;

  // 3. Record the objective metric immediately
  await recordExperimentResult(userId, variant, version, { responseTime });

  // 4. Return variant and version so the frontend can include them in user feedback
  return c.json({ reply: text, variant, version });
});

// When the user rates the response, the frontend sends a feedback request
chatRouter.post('/feedback', async (c) => {
  const { userId, variant, version, rating, resolved } = await c.req.json();
  await recordExperimentResult(userId, variant, version, {
    responseTime: 0, // This call is for subjective metrics only
    userRating: rating,
    resolved,
  });
  return c.json({ ok: true });
});
// #endbook
