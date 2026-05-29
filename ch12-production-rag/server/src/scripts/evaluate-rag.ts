// #book ch12-evaluate-script
import 'dotenv/config';
// ch12-production-rag/server/src/scripts/evaluate-rag.ts
import { evaluateRAGAS } from '../lib/ragas.js';
import { ragService } from '../services/rag-service.js';

const TEST_CASES = [
  {
    question: '公司的年假政策是什么？',
    groundTruth: '员工每年享有 10 天年假...',
  },
  { question: '如何申请报销？', groundTruth: '填写报销单，附上发票...' },
];

async function main() {
  console.log(`评估 ${TEST_CASES.length} 个测试用例...\n`);
  const results = [];

  for (const tc of TEST_CASES) {
    const rag = await ragService.query(tc.question);
    const scores = await evaluateRAGAS({
      question: tc.question,
      answer: rag.answer,
      contexts: rag.citations.map((c) => c.content),
    });
    results.push({ question: tc.question, scores });

    console.log(`问题：${tc.question}`);
    console.log(`  忠实度：      ${(scores.faithfulness * 100).toFixed(1)}%`);
    console.log(
      `  答案相关性：  ${(scores.answerRelevancy * 100).toFixed(1)}%`,
    );
    console.log(
      `  上下文精确率：${(scores.contextPrecision * 100).toFixed(1)}%`,
    );
    console.log(`  综合分：      ${(scores.overall * 100).toFixed(1)}%\n`);
  }

  const avg =
    results.reduce((s, r) => s + r.scores.overall, 0) / results.length;
  console.log(`平均综合分：${(avg * 100).toFixed(1)}%`);
}

main().catch(console.error);
// #endbook
