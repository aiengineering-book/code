// #book-ref ch16-abort-manager
// ch16-multi-agent/server/src/lib/agent/multi/abort-manager.ts

export class AgentAbortManager {
  private controllers = new Map<string, AbortController>();

  /**
   * Create an AbortController for an Agent
   */
  create(agentId: string): AbortSignal {
    const controller = new AbortController();
    this.controllers.set(agentId, controller);
    return controller.signal;
  }

  /**
   * Abort a specific Agent
   */
  abort(agentId: string, reason?: string): void {
    const controller = this.controllers.get(agentId);
    if (controller) {
      controller.abort(reason ?? `Agent ${agentId} manually aborted`);
      this.controllers.delete(agentId);
    }
  }

  /**
   * Abort all Agents
   */
  abortAll(reason?: string): void {
    for (const [_id, controller] of this.controllers) {
      controller.abort(reason ?? 'All Agents aborted');
    }
    this.controllers.clear();
  }

  /**
   * Check whether an Agent has been aborted
   */
  isAborted(agentId: string): boolean {
    return this.controllers.get(agentId)?.signal.aborted ?? true;
  }
}
