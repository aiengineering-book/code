// #book ch16-message-bus

// ch16-multi-agent/server/src/lib/agent/multi/message-bus.ts
export interface AgentMessage {
  id: string;
  from: string; // 发送者 Agent ID
  to: string | 'all'; // 接收者（'all' 表示广播）
  type: 'task' | 'result' | 'status' | 'error';
  payload: unknown;
  timestamp: Date;
}

export type MessageHandler = (message: AgentMessage) => void | Promise<void>;

class MessageBus {
  private handlers = new Map<string, MessageHandler[]>();
  private history: AgentMessage[] = [];

  /**
   * 订阅消息
   */
  subscribe(agentId: string, handler: MessageHandler): () => void {
    const existing = this.handlers.get(agentId) ?? [];
    this.handlers.set(agentId, [...existing, handler]);

    // 返回取消订阅函数
    return () => {
      const current = this.handlers.get(agentId) ?? [];
      this.handlers.set(
        agentId,
        current.filter((h) => h !== handler),
      );
    };
  }

  /**
   * 发布消息
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

    // 找到接收者的处理器
    const recipients =
      message.to === 'all' ? Array.from(this.handlers.keys()) : [message.to];

    for (const recipientId of recipients) {
      const handlers = this.handlers.get(recipientId) ?? [];
      await Promise.all(handlers.map((h) => h(fullMessage)));
    }
  }

  /**
   * 获取历史消息
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
   * 等待特定消息（用于 Agent 间同步）
   */
  waitFor(
    predicate: (msg: AgentMessage) => boolean,
    timeoutMs = 30_000,
  ): Promise<AgentMessage> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('等待消息超时')),
        timeoutMs,
      );

      // 检查历史消息中是否已有满足条件的
      const existing = this.history.find(predicate);
      if (existing) {
        clearTimeout(timer);
        resolve(existing);
        return;
      }

      // 临时订阅所有消息
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

// 每个会话一个消息总线实例
export function createMessageBus(): MessageBus {
  return new MessageBus();
}
// #endbook
