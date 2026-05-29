// #book ch12-evaluate-script
// ch12-production-rag/server/src/scripts/evaluate-rag.ts
import 'dotenv/config';
import { evaluateRAGAS } from '../lib/ragas.js';
import { ragService } from '../services/rag-service.js';

const TEST_CASES = [
  {
    question: "What is the company's vacation policy?",
    groundTruth: 'Employees receive 10 days of paid vacation per year...',
  },
  {
    question: 'How do I submit an expense report?',
    groundTruth: 'Fill out the expense form and attach receipts...',
  },
];

async function main() {
  console.log(`Evaluating ${TEST_CASES.length} test cases...\n`);
  const results = [];

  for (const tc of TEST_CASES) {
    const rag = await ragService.query(tc.question);
    const scores = await evaluateRAGAS({
      question: tc.question,
      answer: rag.answer,
      contexts: rag.citations.map((c) => c.content),
    });
    results.push({ question: tc.question, scores });

    console.log(`Question: ${tc.question}`);
    console.log(`  Faithfulness:       ${(scores.faithfulness * 100).toFixed(1)}%`);
    console.log(`  Answer relevancy:   ${(scores.answerRelevancy * 100).toFixed(1)}%`);
    console.log(`  Context precision:  ${(scores.contextPrecision * 100).toFixed(1)}%`);
    console.log(`  Overall:            ${(scores.overall * 100).toFixed(1)}%\n`);
  }

  const avg =
    results.reduce((s, r) => s + r.scores.overall, 0) / results.length;
  console.log(`Average overall score: ${(avg * 100).toFixed(1)}%`);
}

main().catch(console.error);
// #endbook
