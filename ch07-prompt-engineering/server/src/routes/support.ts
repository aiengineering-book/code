// #book ch07-support-route
// ch07-prompt-engineering/server/src/routes/support.ts
import { buildFewShotPrompt, selectExamples } from '../lib/few-shot.js';
import { callLLM } from '../lib/llm.js';

export async function answerSupportQuestion(userQuestion: string) {
  // 1. Pick 3 most relevant examples for this question
  const relevantExamples = selectExamples(userQuestion, 3);

  // 2. Build the few-shot prompt
  const prompt = buildFewShotPrompt(
    'You are a customer support assistant. Answer user questions in the style of the examples.',
    relevantExamples,
    userQuestion,
  );

  // 3. Send as a user message
  const { text } = await callLLM([{ role: 'user', content: prompt }]);
  return text;
}
// #endbook
