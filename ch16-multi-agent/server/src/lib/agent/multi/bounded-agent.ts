// #book ch16-bounded-agent
// ch16-multi-agent/server/src/lib/agent/multi/bounded-agent.ts
import type { AgentStep, ReActAgent } from '../react-agent.js';

interface BoundedAgentOptions {
  maxSteps?: number; // Maximum steps before forced termination, default 20
  maxTokens?: number; // Cumulative token ceiling
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
            `Agent exceeded maximum steps ${maxSteps}, forced termination. Steps executed: ${this.stepCount}`,
          );
        }

        if (this.totalTokens > maxTokens) {
          throw new Error(
            `Agent exceeded token limit ${maxTokens}, forced termination. Tokens consumed: ${this.totalTokens}`,
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
// #endbook
