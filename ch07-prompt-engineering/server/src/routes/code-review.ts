// #book ch07-code-review-route
// ch07-prompt-engineering/server/src/routes/code-review.ts
import { callLLM } from '../lib/llm.js';
import { CODE_REVIEW_SYSTEM, parseCodeReview } from '../prompts/code-review.js';

export async function reviewCode(code: string) {
  const { text } = await callLLM(
    [
      {
        role: 'user',
        content: `Review the following code:\n\`\`\`\n${code}\n\`\`\``,
      },
    ],
    { system: CODE_REVIEW_SYSTEM, temperature: 0.2 },
  );

  const review = parseCodeReview(text);

  // With structured output, downstream logic is straightforward:
  // - Automatically block deploys below a quality threshold
  if (review.score < 6) {
    throw new Error(`Code quality insufficient: ${review.summary}`);
  }

  // - Push high-severity issues to the code review tool
  const blockers = review.issues.filter((i) => i.severity === 'high');
  if (blockers.length > 0) {
    // ... call GitLab/GitHub API to create review comments
  }

  return review;
}
// #endbook
