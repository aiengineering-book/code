// #book-ref ch16-bounded-agent
import type { AgentStep, ReActAgent } from '../react-agent.js';

interface BoundedAgentOptions {
  maxSteps?: number; // 最多执行几步，默认 20
  maxTokens?: number; // 累计 Token 上限，超过就停
}

export class BoundedSubagent {
  private stepCount = 0;
  private totalTokens = 0;

  constructor(
    private agent: ReActAgent,
    private options: BoundedAgentOptions = {},
  ) {}

  async run(input: string, signal?: AbortSignal): Promise<string> {
    const { maxSteps = 20, maxTokens = 50_000 } = this.options;

    const result = await this.agent.run(input, {
      signal,
      onStep: (step: AgentStep) => {
        this.stepCount++;
        this.totalTokens += step.tokensUsed ?? 0;

        if (this.stepCount > maxSteps) {
          throw new Error(
            `Agent 超过最大步数 ${maxSteps}，强制终止。已执行步骤：${this.stepCount}`,
          );
        }

        if (this.totalTokens > maxTokens) {
          throw new Error(
            `Agent 超过 Token 上限 ${maxTokens}，强制终止。已消耗：${this.totalTokens}`,
          );
        }
      },
    });

    return result.output;
  }

  getStats() {
    return { stepCount: this.stepCount, totalTokens: this.totalTokens };
  }
}
// #endbook-ref
