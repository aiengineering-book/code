// #book-ref ch12-ragas
// ch12-production-rag/server/src/lib/ragas.ts

import { embedText } from './embedding.js';
import { callLLM } from './llm.js';
import { cosineSimilarity } from './similarity.js';

export interface RAGASInput {
  question: string;
  answer: string;
  contexts: string[];
  groundTruth?: string;
}

export interface RAGASScores {
  faithfulness: number;
  answerRelevancy: number;
  contextPrecision: number;
  overall: number;
}

async function evaluateFaithfulness(
  answer: string,
  contexts: string[],
): Promise<number> {
  const { text } = await callLLM(
    [
      {
        role: 'user',
        content: `Reference materials:\n${contexts.join('\n\n')}\n\nAnswer:\n${answer}

Determine which statements in the answer are supported by the reference materials.
Output JSON: {"statements": [{"statement": "...", "supported": true/false}]}
Output JSON only.`,
      },
    ],
    { temperature: 0 },
  );

  try {
    const parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim());
    const statements = parsed.statements as Array<{ supported: boolean }>;
    if (statements.length === 0) return 1.0;
    return statements.filter((s) => s.supported).length / statements.length;
  } catch {
    return 0.5;
  }
}

async function evaluateAnswerRelevancy(
  question: string,
  answer: string,
): Promise<number> {
  const { text } = await callLLM(
    [
      {
        role: 'user',
        content: `Based on the following answer, generate 3 questions most likely to have produced it. One per line, no numbering.\n\nAnswer: ${answer}`,
      },
    ],
    { temperature: 0.3 },
  );

  const questions = text
    .split('\n')
    .map((q) => q.trim())
    .filter(Boolean)
    .slice(0, 3);
  if (questions.length === 0) return 0.5;

  const [origEmb, ...genEmbs] = await Promise.all([
    embedText(question),
    ...questions.map((q) => embedText(q)),
  ]);

  const sims = genEmbs.map((e) => cosineSimilarity(origEmb!, e));
  return sims.reduce((a, b) => a + b, 0) / sims.length;
}

async function evaluateContextPrecision(
  question: string,
  contexts: string[],
): Promise<number> {
  if (contexts.length === 0) return 0;

  const results = await Promise.all(
    contexts.map(async (ctx) => {
      const { text } = await callLLM(
        [
          {
            role: 'user',
            content: `Does this passage help answer the question? Reply only yes or no.\nQuestion: ${question}\nPassage: ${ctx}`,
          },
        ],
        { temperature: 0 },
      );
      return text.trim().toLowerCase().startsWith('yes');
    }),
  );

  return results.filter(Boolean).length / results.length;
}

export async function evaluateRAGAS(input: RAGASInput): Promise<RAGASScores> {
  const [faithfulness, answerRelevancy, contextPrecision] = await Promise.all([
    evaluateFaithfulness(input.answer, input.contexts),
    evaluateAnswerRelevancy(input.question, input.answer),
    evaluateContextPrecision(input.question, input.contexts),
  ]);

  return {
    faithfulness,
    answerRelevancy,
    contextPrecision,
    overall: (faithfulness + answerRelevancy + contextPrecision) / 3,
  };
}
