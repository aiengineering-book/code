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
   * Record a tool call — throws if a problem is detected
   */
  track(toolName: string, input: Record<string, unknown>): void {
    const inputHash = this.hashInput(input);

    // Exact duplicate call (clear loop signal)
    const duplicateCall = this.callHistory.find(
      (c) => c.toolName === toolName && c.inputHash === inputHash,
    );

    if (duplicateCall) {
      throw new Error(
        `Loop detected: tool "${toolName}" called with identical parameters twice. ` +
        `Verify that the tool result is being processed correctly.`,
      );
    }

    // Same tool called too many times
    const sameToolCalls = this.callHistory.filter(
      (c) => c.toolName === toolName,
    ).length;
    if (sameToolCalls >= this.maxSameToolCalls) {
      throw new Error(
        `Tool "${toolName}" has been called ${sameToolCalls + 1} times, exceeding the limit of ${this.maxSameToolCalls}.`,
      );
    }

    // Total calls exceeded
    if (this.callHistory.length >= this.maxTotalCalls) {
      throw new Error(
        `Total tool calls (${this.callHistory.length}) exceeded the limit of ${this.maxTotalCalls}.`,
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
