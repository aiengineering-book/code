// #book ch24-collaboration-service
// full-project/server/src/services/collaboration-service.ts

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
   * Create a collaboration session (multiple users sharing one Agent task)
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
   * Join an existing session (observe the Agent's execution)
   */
  joinSession(sessionId: string, userId: string): CollaborationSession | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    session.participants.add(userId);
    return session;
  }

  /**
   * Broadcast an event to all session participants
   */
  broadcast(sessionId: string, event: unknown): void {
    const handlers = this.listeners.get(sessionId) ?? new Set();
    handlers.forEach((handler) => handler(event));
  }

  /**
   * Subscribe to session events (frontend SSE connection)
   */
  subscribe(sessionId: string, handler: (event: unknown) => void): () => void {
    if (!this.listeners.has(sessionId)) {
      this.listeners.set(sessionId, new Set());
    }
    this.listeners.get(sessionId)?.add(handler);

    // Return unsubscribe function
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
