// #book ch23-ab-testing
import { db } from '../database/client.js';
// ch23-production/server/src/lib/ab-testing.ts
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
  weight: number; // 流量比例，所有变体的权重之和应为 1
  config: Record<string, unknown>; // Prompt、参数等配置
}

// 简单内存存储（生产环境使用数据库）
const experiments = new Map<string, Experiment>();

export function registerExperiment(experiment: Experiment): void {
  experiments.set(experiment.id, experiment);
}

/**
 * 为用户分配实验变体（基于用户 ID 的稳定哈希）
 */
export function assignVariant(
  experimentId: string,
  userId: string,
): ExperimentVariant | null {
  const experiment = experiments.get(experimentId);
  if (!experiment || experiment.status !== 'active') return null;

  // 生成稳定的 0-1 哈希值（同一用户始终分配到同一变体）
  const hash = stableHash(`${experimentId}:${userId}`);

  let cumulative = 0;
  for (const variant of experiment.variants) {
    cumulative += variant.weight;
    if (hash < cumulative) return variant;
  }

  return experiment.variants[experiment.variants.length - 1] ?? null;
}

/**
 * 记录实验结果（与 LangFuse trace 关联）
 */
export async function recordExperimentResult(
  experimentId: string,
  variantId: string,
  userId: string,
  metrics: {
    traceId?: string;
    score?: number; // 质量评分
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
 * 获取实验统计数据
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
  return Math.abs(hash) / 2147483647; // 归一化到 0-1
}

// 示例：RAG 系统提示的 A/B 测试
export function setupRAGPromptExperiment() {
  registerExperiment({
    id: 'rag-prompt-v2',
    name: 'RAG 系统提示优化',
    description: '测试更严格的引用要求是否能提升忠实度',
    status: 'active',
    startedAt: new Date(),
    variants: [
      {
        id: 'control',
        name: '当前版本',
        weight: 0.5,
        config: {
          systemPrompt: '只基于提供的参考资料回答，标注 [来源N]。',
        },
      },
      {
        id: 'treatment',
        name: '强引用版本',
        weight: 0.5,
        config: {
          systemPrompt: `严格规则：
1. 每个具体陈述后必须标注 [来源N]
2. 找不到支撑信息时说"参考资料未涉及此问题"
3. 禁止补充参考资料以外的信息`,
        },
      },
    ],
  });
}
// #endbook
