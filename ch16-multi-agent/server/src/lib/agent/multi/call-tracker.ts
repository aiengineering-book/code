// #book ch16-call-tracker
// ch16-multi-agent/server/src/lib/agent/multi/call-tracker.ts

export class AgentCallTracker {
  // callStack records the current call chain as a list of agentIds
  private callStack: string[] = [];
  private maxDepth: number;

  constructor(maxDepth = 5) {
    this.maxDepth = maxDepth;
  }

  /**
   * Check for cycles before calling a sub-Agent
   * @throws if a cycle is detected or maximum depth is exceeded
   */
  enter(agentId: string): void {
    if (this.callStack.includes(agentId)) {
      const chain = [...this.callStack, agentId].join(' → ');
      throw new Error(`Circular Agent call detected: ${chain}`);
    }

    if (this.callStack.length >= this.maxDepth) {
      throw new Error(
        `Agent call depth exceeded limit ${this.maxDepth}, current chain: ${this.callStack.join(' → ')}`,
      );
    }

    this.callStack.push(agentId);
  }

  /**
   * Pop the call stack when a sub-Agent returns
   */
  exit(agentId: string): void {
    const idx = this.callStack.lastIndexOf(agentId);
    if (idx !== -1) {
      this.callStack.splice(idx, 1);
    }
  }

  getStack(): string[] {
    return [...this.callStack];
  }
}

// Usage: wrap sub-Agent calls in the Orchestrator
const tracker = new AgentCallTracker(3);

async function _callSubagent(
  agentId: string,
  input: string,
  subagents: Record<string, { run: (input: string) => Promise<string> }>,
): Promise<string> {
  tracker.enter(agentId); // Throws immediately if a cycle is detected
  try {
    return await subagents[agentId]?.run(input);
  } finally {
    tracker.exit(agentId);
  }
}
// #endbook
