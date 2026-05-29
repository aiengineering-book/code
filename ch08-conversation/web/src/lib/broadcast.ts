// #book ch08-broadcast
// ch08-conversation/web/src/lib/broadcast.ts
const CHANNEL_NAME = 'chat-sync';

export interface SyncEvent {
  type: 'new-message';
  conversationId: string;
  message: {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    createdAt: string;
  };
}

class ChatBroadcast {
  private channel: BroadcastChannel;
  private handlers: Array<(event: SyncEvent) => void> = [];

  constructor() {
    this.channel = new BroadcastChannel(CHANNEL_NAME);
    this.channel.onmessage = (e: MessageEvent<SyncEvent>) => {
      this.handlers.forEach((h) => h(e.data));
    };
  }

  emit(event: SyncEvent) {
    this.channel.postMessage(event);
  }

  on(handler: (event: SyncEvent) => void) {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }

  destroy() {
    this.channel.close();
  }
}

export const chatBroadcast = new ChatBroadcast();
// #endbook
