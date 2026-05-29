// #book-ref ch08-conversation/server/src/lib/cost.ts
// Price unit: USD per million tokens (based on official pricing; subject to change)
const PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 2.5, output: 10.0 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
};

export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const p = PRICING[model] ?? PRICING['gpt-4o']!;
  return (
    (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output
  );
}

export async function trackUsage(record: {
  userId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  endpoint: string;
}): Promise<void> {
  // ch08 focuses on conversation, not cost tracking
  // In production, this would write to a usage_logs table (see ch06)
  console.log(
    `[usage] ${record.endpoint}: ${record.inputTokens}+${record.outputTokens} tokens, $${record.costUsd.toFixed(6)}`,
  );
}
