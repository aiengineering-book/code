// #book ch06-cost
// ch06-llm-api/server/src/lib/cost.ts
// Prices in USD per million tokens (subject to change — verify against provider docs)
const PRICING = {
  'gpt-4o': { input: 2.5, output: 10.0 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
} as const;

export function estimateCost(
  model: keyof typeof PRICING,
  inputTokens: number,
  outputTokens: number,
): number {
  const p = PRICING[model];
  return (
    (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output
  );
}
// #endbook
