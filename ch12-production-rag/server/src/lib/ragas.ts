// #book ch12-ragas

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
        content: `参考资料：\n${contexts.join('\n\n')}\n\n答案：\n${answer}

判断答案中每个陈述是否有据可查，输出 JSON：
{"statements": [{"statement": "...", "supported": true/false}]}
只输出 JSON。`,
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
        content: `根据以下答案，生成 3 个最可能对应的问题。每行一个，不要编号。\n\n答案：${answer}`,
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
            content: `判断文档片段是否对回答问题有用，只回答 yes 或 no。\n问题：${question}\n片段：${ctx}`,
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
// #endbook
