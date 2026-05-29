// #book ch06-cost
// 价格单位：美元 / 百万 Token（以官网公布为准，会随时调整）
// ch06-llm-api/server/src/lib/cost.ts
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
