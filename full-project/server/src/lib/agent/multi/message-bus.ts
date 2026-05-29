// #book-ref ch16-message-bus
// ch16-multi-agent/server/src/lib/agent/multi/message-bus.ts

export interface AgentMessage {
  id: string;
  from: string; // Sender Agent ID
  to: string | 'all'; // Recipient ('all' for broadcast)
  type: 'task' | 'result' | 'status' | 'error';
  payload: unknown;
  timestamp: Date;
}

export type MessageHandler = (message: AgentMessage) => void | Promise<void>;

class MessageBus {
  private handlers = new Map<string, MessageHandler[]>();
  private history: AgentMessage[] = [];

  /**
   * Subscribe to messages
   */
  subscribe(agentId: string, handler: MessageHandler): () => void {
    const existing = this.handlers.get(agentId) ?? [];
    this.handlers.set(agentId, [...existing, handler]);

    // Return unsubscribe function
    return () => {
      const current = this.handlers.get(agentId) ?? [];
      this.handlers.set(
        agentId,
        current.filter((h) => h !== handler),
      );
    };
  }

  /**
   * Publish a message
   */
  async publish(
    message: Omit<AgentMessage, 'id' | 'timestamp'>,
  ): Promise<void> {
    const fullMessage: AgentMessage = {
      ...message,
      id: crypto.randomUUID(),
      timestamp: new Date(),
    };

    this.history.push(fullMessage);

    // Find recipient handlers
    const recipients =
      message.to === 'all' ? Array.from(this.handlers.keys()) : [message.to];

    for (const recipientId of recipients) {
      const handlers = this.handlers.get(recipientId) ?? [];
      await Promise.all(handlers.map((h) => h(fullMessage)));
    }
  }

  /**
   * Get message history
   */
  getHistory(filter?: {
    from?: string;
    to?: string;
    type?: AgentMessage['type'];
  }): AgentMessage[] {
    return this.history.filter((msg) => {
      if (filter?.from && msg.from !== filter.from) return false;
      if (filter?.to && msg.to !== filter.to && msg.to !== 'all') return false;
      if (filter?.type && msg.type !== filter.type) return false;
      return true;
    });
  }

  /**
   * Wait for a specific message (for Agent-to-Agent synchronization)
   */
  waitFor(
    predicate: (msg: AgentMessage) => boolean,
    timeoutMs = 30_000,
  ): Promise<AgentMessage> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('Timed out waiting for message')),
        timeoutMs,
      );

      // Check history for a message that already satisfies the predicate
      const existing = this.history.find(predicate);
      if (existing) {
        clearTimeout(timer);
        resolve(existing);
        return;
      }

      // Temporarily subscribe to all messages
      const tempId = `wait_${crypto.randomUUID()}`;
      const unsubscribe = this.subscribe(tempId, (msg) => {
        if (predicate(msg)) {
          clearTimeout(timer);
          unsubscribe();
          resolve(msg);
        }
      });
    });
  }
}

// One message bus instance per session
export function createMessageBus(): MessageBus {
  return new MessageBus();
}
