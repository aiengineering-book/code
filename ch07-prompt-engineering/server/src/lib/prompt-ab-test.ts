// #book ch07-prompt-ab-test
// ch07-prompt-engineering/server/src/lib/prompt-ab-test.ts
import * as CustomerServiceV1 from '../prompts/customer-service/v1.js';
import * as CustomerServiceV2 from '../prompts/customer-service/v2.js';

// db and experimentLogs come from your database setup — see Chapter 4
// import { db } from '../database/client.js';
// import { experimentLogs } from '../database/schema.js';

type Variant = 'control' | 'treatment';

/**
 * Stable A/B assignment based on user ID — the same user always gets the same variant
 */
export function assignVariant(userId: string): Variant {
  // Simple hash: UUID's last character is a hex digit (0-f)
  // 0-7 → control, 8-f → treatment: roughly 50/50
  // Adjust the threshold for other splits (e.g., 10% treatment)
  const lastChar = userId.slice(-1);
  const num = parseInt(lastChar, 16);
  return num < 8 ? 'control' : 'treatment';
}

export function getPromptVariant(userId: string) {
  const variant = assignVariant(userId);

  if (variant === 'control') {
    return {
      variant,
      prompt: CustomerServiceV1.SYSTEM_PROMPT,
      version: CustomerServiceV1.VERSION,
    };
  } else {
    return {
      variant,
      prompt: CustomerServiceV2.SYSTEM_PROMPT,
      version: CustomerServiceV2.VERSION,
    };
  }
}

// Record experiment results in the route
export async function recordExperimentResult(
  userId: string,
  variant: Variant,
  promptVersion: string,
  metrics: {
    responseTime: number;
    userRating?: number;
    resolved?: boolean;
  },
) {
  await db.insert(experimentLogs).values({
    userId,
    variant,
    promptVersion,
    ...metrics,
    createdAt: new Date(),
  });
}
// #endbook
