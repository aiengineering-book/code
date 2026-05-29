// #book ch24-collaboration-service

interface CollaborationSession {
  sessionId: string;
  task: string;
  participants: Set<string>; // userId
  steps: Array<{ type: string; content: string; timestamp: Date }>;
  status: 'running' | 'completed' | 'failed';
  result?: string;
}

class CollaborationService {
  private sessions = new Map<string, CollaborationSession>();
  private listeners = new Map<string, Set<(event: unknown) => void>>();

  /**
   * 创建协作会话（多人共享同一个 Agent 任务）
   */
  createSession(task: string, creatorId: string): string {
    const sessionId = crypto.randomUUID();
    this.sessions.set(sessionId, {
      sessionId,
      task,
      participants: new Set([creatorId]),
      steps: [],
      status: 'running',
    });
    return sessionId;
  }

  /**
   * 加入现有会话（观察 Agent 执行过程）
   */
  joinSession(sessionId: string, userId: string): CollaborationSession | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    session.participants.add(userId);
    return session;
  }

  /**
   * 广播事件给会话所有参与者
   */
  broadcast(sessionId: string, event: unknown): void {
    const handlers = this.listeners.get(sessionId) ?? new Set();
    handlers.forEach((handler) => handler(event));
  }

  /**
   * 订阅会话事件（前端 SSE 连接）
   */
  subscribe(sessionId: string, handler: (event: unknown) => void): () => void {
    if (!this.listeners.has(sessionId)) {
      this.listeners.set(sessionId, new Set());
    }
    this.listeners.get(sessionId)?.add(handler);

    // 返回取消订阅函数
    return () => {
      this.listeners.get(sessionId)?.delete(handler);
    };
  }

  addStep(sessionId: string, step: { type: string; content: string }): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const fullStep = { ...step, timestamp: new Date() };
    session.steps.push(fullStep);
    this.broadcast(sessionId, { type: 'step', step: fullStep });
  }

  completeSession(sessionId: string, result: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.status = 'completed';
    session.result = result;
    this.broadcast(sessionId, { type: 'complete', result });
  }

  getSession(sessionId: string): CollaborationSession | null {
    return this.sessions.get(sessionId) ?? null;
  }
}

export const collaborationService = new CollaborationService();
// #endbook
