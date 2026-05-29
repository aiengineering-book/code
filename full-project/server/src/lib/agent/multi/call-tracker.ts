// #book-ref ch16-call-tracker

export class AgentCallTracker {
  // callStack 记录当前调用链，格式为 agentId 列表
  private callStack: string[] = [];
  private maxDepth: number;

  constructor(maxDepth = 5) {
    this.maxDepth = maxDepth;
  }

  /**
   * 在调用子 Agent 之前检查是否形成循环
   * @throws 如果形成循环或超过最大深度
   */
  enter(agentId: string): void {
    if (this.callStack.includes(agentId)) {
      const chain = [...this.callStack, agentId].join(' → ');
      throw new Error(`检测到 Agent 循环调用：${chain}`);
    }

    if (this.callStack.length >= this.maxDepth) {
      throw new Error(
        `Agent 调用深度超过上限 ${this.maxDepth}，当前链路：${this.callStack.join(' → ')}`,
      );
    }

    this.callStack.push(agentId);
  }

  /**
   * 子 Agent 返回后，弹出调用栈
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

// 使用示例：在 Orchestrator 调用 Subagent 时
const tracker = new AgentCallTracker(3);

async function _callSubagent(
  agentId: string,
  input: string,
  subagents: Record<string, { run: (input: string) => Promise<string> }>,
): Promise<string> {
  tracker.enter(agentId); // 如果形成循环，这里直接抛出
  try {
    return await subagents[agentId]?.run(input);
  } finally {
    tracker.exit(agentId);
  }
}
// #endbook-ref
