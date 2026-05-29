// #book ch16-abort-manager

// ch16-multi-agent/server/src/lib/agent/multi/abort-manager.ts
export class AgentAbortManager {
  private controllers = new Map<string, AbortController>();

  /**
   * 为 Agent 创建 AbortController
   */
  create(agentId: string): AbortSignal {
    const controller = new AbortController();
    this.controllers.set(agentId, controller);
    return controller.signal;
  }

  /**
   * 中止特定 Agent
   */
  abort(agentId: string, reason?: string): void {
    const controller = this.controllers.get(agentId);
    if (controller) {
      controller.abort(reason ?? `Agent ${agentId} 被手动中止`);
      this.controllers.delete(agentId);
    }
  }

  /**
   * 中止所有 Agent
   */
  abortAll(reason?: string): void {
    for (const [_id, controller] of this.controllers) {
      controller.abort(reason ?? '所有 Agent 被中止');
    }
    this.controllers.clear();
  }

  /**
   * 检查 Agent 是否已被中止
   */
  isAborted(agentId: string): boolean {
    return this.controllers.get(agentId)?.signal.aborted ?? true;
  }
}
// #endbook
