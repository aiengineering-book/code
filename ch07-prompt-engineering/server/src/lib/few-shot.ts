// #book ch07-few-shot
// ch07-prompt-engineering/server/src/lib/few-shot.ts

interface Example {
  input: string;
  output: string;
  tags: string[];
}

const exampleLibrary: Example[] = [
  {
    input: 'How do I request a refund?',
    output: '...',
    tags: ['refund', 'order'],
  },
  {
    input: 'How long does shipping take?',
    output: '...',
    tags: ['shipping', 'order'],
  },
  {
    input: 'Does the product come with a warranty?',
    output: '...',
    tags: ['warranty', 'product'],
  },
  // ...more examples
];

/**
 * Select the most relevant examples from the library based on user input.
 * Production use: vector similarity search (Part 3 covers this).
 * Here: keyword matching as a simple implementation.
 */
export function selectExamples(userInput: string, maxCount = 3): Example[] {
  const inputWords = userInput.toLowerCase().split(/\s+/);

  const scored = exampleLibrary.map((example) => ({
    example,
    score: example.tags.filter((tag) =>
      inputWords.some((word) => word.includes(tag) || tag.includes(word)),
    ).length,
  }));

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, maxCount)
    .map((s) => s.example);
}

export function buildFewShotPrompt(
  task: string,
  examples: Example[],
  userInput: string,
): string {
  const exampleText = examples
    .map((e) => `Input: ${e.input}\nOutput: ${e.output}`)
    .join('\n\n');

  return `
${task}

Examples:

${exampleText}

Now handle:
Input: ${userInput}
Output:`.trim();
}
// #endbook
