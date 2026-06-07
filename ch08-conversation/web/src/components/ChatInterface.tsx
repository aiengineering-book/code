import { useEffect, useRef, useState } from 'react';
import { useChat } from '../hooks/useChat.js';
import { getToken } from '../lib/api.js';
import { useChatStore } from '../stores/chat-store.js';

export function ChatInterface() {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const store = useChatStore();
  const { sendMessage, stopStreaming, loadMessages } = useChat();

  useEffect(() => {
    // Load conversation list on mount
    const token = getToken();
    if (!token) return;
    fetch('/api/chatbot/conversations', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data) => store.setConversations(Array.isArray(data) ? data : []))
      .catch(console.error);
  }, [store.setConversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const handleSend = async () => {
    if (!input.trim() || store.isStreaming) return;
    const message = input;
    setInput('');
    await sendMessage(message);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSelectConversation = async (id: string) => {
    store.setCurrentConversation(id);
    await loadMessages(id);
  };

  const handleNewConversation = () => {
    store.setCurrentConversation(null);
    store.setMessages([]);
  };

  return (
    <div
      style={{
        display: 'flex',
        height: '100%',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      {/* Sidebar */}
      <div
        style={{
          width: 260,
          borderRight: '1px solid #e0e0e0',
          padding: 16,
          overflowY: 'auto',
          background: '#f9f9f9',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <button
          onClick={handleNewConversation}
          style={{
            width: '100%',
            padding: '10px',
            marginBottom: 16,
            cursor: 'pointer',
            border: '1px solid #ccc',
            borderRadius: 6,
            background: '#fff',
          }}
        >
          + New chat
        </button>
        {store.conversations.map((conv) => (
          <div
            key={conv.id}
            onClick={() => handleSelectConversation(conv.id)}
            style={{
              padding: '10px 12px',
              marginBottom: 4,
              cursor: 'pointer',
              borderRadius: 6,
              background:
                conv.id === store.currentConversationId
                  ? '#e3e3e3'
                  : 'transparent',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {conv.title}
          </div>
        ))}
      </div>

      {/* Main chat area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {store.messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                marginBottom: 16,
                textAlign: msg.role === 'user' ? 'right' : 'left',
              }}
            >
              <div
                style={{
                  display: 'inline-block',
                  maxWidth: '70%',
                  padding: '10px 16px',
                  borderRadius: 12,
                  background: msg.role === 'user' ? '#007aff' : '#f0f0f0',
                  color: msg.role === 'user' ? '#fff' : '#333',
                  textAlign: 'left',
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {store.streamingText && (
            <div style={{ marginBottom: 16, textAlign: 'left' }}>
              <div
                style={{
                  display: 'inline-block',
                  maxWidth: '70%',
                  padding: '10px 16px',
                  borderRadius: 12,
                  background: '#f0f0f0',
                  color: '#333',
                  textAlign: 'left',
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {store.streamingText}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div
          style={{
            borderTop: '1px solid #e0e0e0',
            padding: '12px 24px',
            display: 'flex',
            gap: 8,
          }}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter a message..."
            rows={2}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: 8,
              border: '1px solid #ccc',
              resize: 'none',
              fontFamily: 'inherit',
              fontSize: 14,
            }}
          />
          {store.isStreaming ? (
            <button
              onClick={stopStreaming}
              style={{
                padding: '0 20px',
                borderRadius: 8,
                border: 'none',
                background: '#ff3b30',
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              Stop
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              style={{
                padding: '0 20px',
                borderRadius: 8,
                border: 'none',
                background: input.trim() ? '#007aff' : '#ccc',
                color: '#fff',
                cursor: input.trim() ? 'pointer' : 'default',
              }}
            >
              Send
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
