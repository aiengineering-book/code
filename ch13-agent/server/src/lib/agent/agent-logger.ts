// packages/server/src/lib/agent/agent-logger.ts
// #book ch13-agent-logger
import type { AgentStep } from './react-agent.js';
// ch13-agent/server/src/lib/agent/agent-logger.ts

export interface AgentRunLog {
  runId: string;
  task: string;
  startTime: Date;
  endTime?: Date;
  steps: AgentStep[];
  finalAnswer?: string;
  totalTokens: number;
  success: boolean;
  errorMessage?: string;
}

export class AgentLogger {
  private runs = new Map<string, AgentRunLog>();

  startRun(task: string): string {
    const runId = crypto.randomUUID();
    this.runs.set(runId, {
      runId,
      task,
      startTime: new Date(),
      steps: [],
      totalTokens: 0,
      success: false,
    });
    return runId;
  }

  addStep(runId: string, step: AgentStep): void {
    const run = this.runs.get(runId);
    if (run) run.steps.push(step);
  }

  completeRun(
    runId: string,
    result: { answer: string; success: boolean; error?: string },
  ): void {
    const run = this.runs.get(runId);
    if (!run) return;

    run.endTime = new Date();
    run.finalAnswer = result.answer;
    run.success = result.success;
    if (result.error !== undefined) {
      run.errorMessage = result.error;
    }

    // 持久化到数据库（异步）
    this.persistRun(run).catch(console.error);
  }

  private async persistRun(run: AgentRunLog): Promise<void> {
    // 写入数据库（具体实现略）
    console.log(
      `[AgentLogger] 运行完成：${run.runId}，共 ${run.steps.length} 步，${run.success ? '成功' : '失败'}`,
    );
  }

  getRecentRuns(limit = 10): AgentRunLog[] {
    return Array.from(this.runs.values())
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
      .slice(0, limit);
  }
}

export const agentLogger = new AgentLogger();
// #endbook
