// #book-ref ch23-ab-testing
// ch23-production/server/src/lib/ab-testing.ts
import { db } from '../database/client.js';
import { experimentResults } from '../database/schema.js';

export interface Experiment {
  id: string;
  name: string;
  description: string;
  variants: ExperimentVariant[];
  startedAt: Date;
  endedAt?: Date;
  status: 'active' | 'paused' | 'completed';
}

export interface ExperimentVariant {
  id: string;
  name: string;
  weight: number; // Traffic fraction; all variant weights must sum to 1
  config: Record<string, unknown>; // Prompt, parameters, etc.
}

// Simple in-memory storage (use database in production)
const experiments = new Map<string, Experiment>();

export function registerExperiment(experiment: Experiment): void {
  experiments.set(experiment.id, experiment);
}

/**
 * Assign an experiment variant for a user (stable hash based on user ID)
 */
export function assignVariant(
  experimentId: string,
  userId: string,
): ExperimentVariant | null {
  const experiment = experiments.get(experimentId);
  if (!experiment || experiment.status !== 'active') return null;

  // Generate a stable 0-1 hash (same user always gets the same variant)
  const hash = stableHash(`${experimentId}:${userId}`);

  let cumulative = 0;
  for (const variant of experiment.variants) {
    cumulative += variant.weight;
    if (hash < cumulative) return variant;
  }

  return experiment.variants[experiment.variants.length - 1] ?? null;
}

/**
 * Record experiment result (linked to LangFuse trace)
 */
export async function recordExperimentResult(
  experimentId: string,
  variantId: string,
  userId: string,
  metrics: {
    traceId?: string;
    score?: number; // Quality score
    latencyMs?: number;
    inputTokens?: number;
    outputTokens?: number;
    userRating?: 1 | -1;
  },
): Promise<void> {
  await db.insert(experimentResults).values({
    id: crypto.randomUUID(),
    experimentId,
    variantId,
    userId,
    ...metrics,
  });
}

/**
 * Get experiment statistics
 */
export async function getExperimentStats(experimentId: string) {
  const results = await db.query.experimentResults.findMany({
    where: (r, { eq }) => eq(r.experimentId, experimentId),
  });

  const byVariant = new Map<string, typeof results>();
  for (const result of results) {
    if (!byVariant.has(result.variantId)) {
      byVariant.set(result.variantId, []);
    }
    byVariant.get(result.variantId)?.push(result);
  }

  return Array.from(byVariant.entries()).map(([variantId, variantResults]) => {
    const ratings = variantResults.filter((r) => r.userRating !== null);
    const positiveRate =
      ratings.length > 0
        ? ratings.filter((r) => r.userRating === 1).length / ratings.length
        : null;

    return {
      variantId,
      sampleSize: variantResults.length,
      avgLatencyMs: avg(
        variantResults.map((r) => r.latencyMs).filter(Boolean) as number[],
      ),
      avgInputTokens: avg(
        variantResults.map((r) => r.inputTokens).filter(Boolean) as number[],
      ),
      positiveRating: positiveRate,
    };
  });
}

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function stableHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) / 2147483647; // Normalize to 0-1
}

// Example: A/B test for RAG system prompt
export function setupRAGPromptExperiment() {
  registerExperiment({
    id: 'rag-prompt-v2',
    name: 'RAG System Prompt Optimization',
    description:
      'Test whether stricter citation requirements improve faithfulness',
    status: 'active',
    startedAt: new Date(),
    variants: [
      {
        id: 'control',
        name: 'Current version',
        weight: 0.5,
        config: {
          systemPrompt:
            'Answer only based on the provided references, annotating [Source N].',
        },
      },
      {
        id: 'treatment',
        name: 'Strict citation version',
        weight: 0.5,
        config: {
          systemPrompt: `Strict rules:
1. Every specific statement must be annotated with [Source N]
2. If no supporting information is found, say "The references do not cover this question"
3. Do not add information beyond the references`,
        },
      },
    ],
  });
}
