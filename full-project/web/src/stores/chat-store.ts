// #book-ref ch08-chat-store
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
}

interface ChatStore {
  // 会话列表
  conversations: Conversation[];
  // 当前会话 ID
  currentConversationId: string | null;
  // 当前会话的消息
  messages: Message[];
  // 流式输出中的临时文本
  streamingText: string;
  // 是否正在流式输出
  isStreaming: boolean;

  setConversations: (convs: Conversation[]) => void;
  setCurrentConversation: (id: string | null) => void;
  setMessages: (msgs: Message[]) => void;
  appendMessage: (msg: Message) => void;
  setStreamingText: (text: string) => void;
  appendStreamingText: (text: string) => void;
  finalizeStreaming: (assistantMessage: Message) => void;
  setIsStreaming: (v: boolean) => void;
}

export const useChatStore = create<ChatStore>()(
  persist(
    (set) => ({
      conversations: [],
      currentConversationId: null,
      messages: [],
      streamingText: '',
      isStreaming: false,

      setConversations: (conversations) => set({ conversations }),
      setCurrentConversation: (id) =>
        set({ currentConversationId: id, messages: [], streamingText: '' }),
      setMessages: (messages) => set({ messages }),
      appendMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
      setStreamingText: (text) => set({ streamingText: text }),
      appendStreamingText: (text) =>
        set((s) => ({ streamingText: s.streamingText + text })),
      finalizeStreaming: (msg) =>
        set((s) => ({
          messages: [...s.messages, msg],
          streamingText: '',
          isStreaming: false,
        })),
      setIsStreaming: (isStreaming) => set({ isStreaming }),
    }),
    {
      name: 'chat-store',
      version: 1,
      migrate: () => ({ conversations: [], currentConversationId: null }),
      partialize: (s) => ({
        conversations: s.conversations,
        currentConversationId: s.currentConversationId,
      }),
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as object),
        // 保证 conversations 始终是数组
        conversations: Array.isArray((persisted as any)?.conversations)
          ? (persisted as any).conversations
          : [],
      }),
    },
  ),
);
// #endbook-ref
