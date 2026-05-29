// packages/server/src/lib/agent/call-tracker.ts
// #book ch14-call-tracker

// ch14-tool-calling/server/src/lib/agent/call-tracker.ts
export class ToolCallTracker {
  private callHistory: Array<{ toolName: string; inputHash: string }> = [];
  private readonly maxSameToolCalls: number;
  private readonly maxTotalCalls: number;

  constructor(
    options: { maxSameToolCalls?: number; maxTotalCalls?: number } = {},
  ) {
    this.maxSameToolCalls = options.maxSameToolCalls ?? 3;
    this.maxTotalCalls = options.maxTotalCalls ?? 20;
  }

  /**
   * 记录一次工具调用，如果检测到问题则抛出错误
   */
  track(toolName: string, input: Record<string, unknown>): void {
    const inputHash = this.hashInput(input);

    // 检测完全相同的调用（循环的明显信号）
    const duplicateCall = this.callHistory.find(
      (c) => c.toolName === toolName && c.inputHash === inputHash,
    );

    if (duplicateCall) {
      throw new Error(
        `检测到循环调用：工具 "${toolName}" 使用相同参数被重复调用。` +
          `请检查工具结果是否被正确处理。`,
      );
    }

    // 检测同一工具调用次数过多
    const sameToolCalls = this.callHistory.filter(
      (c) => c.toolName === toolName,
    ).length;
    if (sameToolCalls >= this.maxSameToolCalls) {
      throw new Error(
        `工具 "${toolName}" 已被调用 ${sameToolCalls + 1} 次，超出限制（${this.maxSameToolCalls}）。`,
      );
    }

    // 检测总调用次数
    if (this.callHistory.length >= this.maxTotalCalls) {
      throw new Error(
        `工具调用总次数（${this.callHistory.length}）超出限制（${this.maxTotalCalls}）。`,
      );
    }

    this.callHistory.push({ toolName, inputHash });
  }

  private hashInput(input: Record<string, unknown>): string {
    return JSON.stringify(input, Object.keys(input).sort());
  }

  get stats() {
    return {
      totalCalls: this.callHistory.length,
      callsByTool: this.callHistory.reduce(
        (acc, c) => {
          acc[c.toolName] = (acc[c.toolName] ?? 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      ),
    };
  }
}
// #endbook
