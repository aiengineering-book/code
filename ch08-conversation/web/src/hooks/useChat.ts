// #book ch08-useChat
import { useCallback, useRef } from 'react';
// ch08-conversation/web/src/hooks/useChat.ts
import { useChatStore } from '../stores/chat-store.js';

function getToken(): string {
  return 'demo-token';
}

export function useChat() {
  const store = useChatStore();
  const abortRef = useRef<AbortController | null>(null);

  const loadMessages = useCallback(
    async (conversationId: string) => {
      const res = await fetch(
        `/api/chatbot/conversations/${conversationId}/messages`,
        {
          headers: { Authorization: `Bearer ${getToken()}` },
        },
      );
      if (res.ok) {
        const msgs = await res.json();
        store.setMessages(msgs);
      }
    },
    [store.setMessages],
  );

  const sendMessage = useCallback(
    async (content: string) => {
      if (store.isStreaming || !content.trim()) return;

      // 乐观更新：立刻显示用户消息
      store.appendMessage({
        id: crypto.randomUUID(),
        role: 'user',
        content,
        createdAt: new Date().toISOString(),
      });
      store.setIsStreaming(true);
      store.setStreamingText('');

      abortRef.current = new AbortController();

      try {
        const res = await fetch('/api/chatbot/stream', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify({
            message: content,
            conversationId: store.currentConversationId,
          }),
          signal: abortRef.current.signal,
        });

        if (!res.body) throw new Error('No stream');

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let assistantContent = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const raw = line.slice(6).trim();
            if (!raw) continue;

            try {
              const data = JSON.parse(raw);

              // 处理各类 SSE 事件
              if (data.conversationId && !store.currentConversationId) {
                store.setCurrentConversation(data.conversationId);
              }

              if (data.text !== undefined) {
                assistantContent += data.text;
                store.appendStreamingText(data.text);
              }

              if (data.inputTokens !== undefined) {
                // 流结束，将临时文本转为正式消息
                store.finalizeStreaming({
                  id: crypto.randomUUID(),
                  role: 'assistant',
                  content: assistantContent,
                  createdAt: new Date().toISOString(),
                });
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') {
          console.error('发送失败：', error);
        }
        store.setIsStreaming(false);
      }
    },
    [store],
  );

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    store.setIsStreaming(false);
  }, [store.setIsStreaming]);

  return { sendMessage, stopStreaming, loadMessages };
}
// #endbook
