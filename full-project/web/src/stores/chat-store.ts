// #book-ref ch08-chat-store
// ch08-conversation/web/src/stores/chat-store.ts
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
  // Conversation list
  conversations: Conversation[];
  // Current conversation ID
  currentConversationId: string | null;
  // Messages in the current conversation
  messages: Message[];
  // Temporary text during streaming output
  streamingText: string;
  // Whether streaming is in progress
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
      // Only persist conversation list and current conversation ID
      partialize: (s) => ({
        conversations: s.conversations,
        currentConversationId: s.currentConversationId,
      }),
        // Ensure conversations is always an array
    },
  ),
);
