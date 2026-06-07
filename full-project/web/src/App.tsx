// #book ch24-app
// full-project/web/src/App.tsx
import { useEffect, useState } from 'react';
import { ChatInterface } from './components/ChatInterface.js';
import { DocumentUpload } from './components/DocumentUpload.js';
import { MCPPanel } from './components/MCPPanel.js';
import { MultiAgentPanel } from './components/MultiAgentPanel.js';
import { MultimodalInput } from './components/MultimodalInput.js';
import { KnowledgeBasePage } from './pages/KnowledgeBase.js';

type Tab = 'chat' | 'rag' | 'agent' | 'multimodal' | 'mcp' | 'docs';

const TAB_CONFIG: Array<{ id: Tab; icon: string; label: string }> = [
  { id: 'chat', icon: '💬', label: 'Chat' },
  { id: 'rag', icon: '📚', label: 'Knowledge Base' },
  { id: 'agent', icon: '🤖', label: 'Agent' },
  { id: 'multimodal', icon: '🎙️', label: 'Multimodal' },
  { id: 'mcp', icon: '🔌', label: 'MCP Tools' },
  { id: 'docs', icon: '📄', label: 'Documents' },
];

function LoginForm({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'login' | 'register'>('login');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const endpoint =
      mode === 'login' ? '/api/auth/login' : '/api/auth/register';
    const body =
      mode === 'register'
        ? { email, password, name: email.split('@')[0] }
        : { email, password };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error?.message ?? 'Failed');
      return;
    }
    localStorage.setItem('token', data.token);
    onLogin();
  };

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f8fafc',
      }}
    >
      <form
        onSubmit={submit}
        style={{
          background: '#fff',
          padding: 32,
          borderRadius: 12,
          width: 320,
          boxShadow: '0 4px 24px #0001',
        }}
      >
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 4 }}>
            AI Workbench
          </div>
          <h2 style={{ margin: 0, fontSize: 22 }}>
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          </h2>
        </div>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          type="email"
          required
          style={{
            width: '100%',
            padding: '10px 12px',
            marginBottom: 12,
            border: '1px solid #d1d5db',
            borderRadius: 8,
            fontSize: 14,
            boxSizing: 'border-box',
          }}
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          type="password"
          required
          style={{
            width: '100%',
            padding: '10px 12px',
            marginBottom: 16,
            border: '1px solid #d1d5db',
            borderRadius: 8,
            fontSize: 14,
            boxSizing: 'border-box',
          }}
        />
        {error && (
          <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>
            {error}
          </div>
        )}
        <button
          type="submit"
          style={{
            width: '100%',
            padding: '10px',
            background: '#3b82f6',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: 15,
            cursor: 'pointer',
          }}
        >
          {mode === 'login' ? 'Sign In' : 'Register'}
        </button>
        <div
          style={{
            textAlign: 'center',
            marginTop: 12,
            fontSize: 13,
            color: '#6b7280',
            cursor: 'pointer',
          }}
          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
        >
          {mode === 'login'
            ? "Don't have an account? Register"
            : 'Already have an account? Sign in'}
        </div>
      </form>
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [token, setToken] = useState(() => localStorage.getItem('token') ?? '');

  useEffect(() => {
    const onStorage = () => setToken(localStorage.getItem('token') ?? '');
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  if (!token)
    return (
      <LoginForm
        onLogin={() => setToken(localStorage.getItem('token') ?? '')}
      />
    );

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      {/* Sidebar navigation */}
      <nav
        style={{
          width: 72,
          background: '#1e293b',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '16px 0',
          gap: 4,
          flexShrink: 0,
        }}
      >
        {/* Logo */}
        <div
          style={{
            width: 40,
            height: 40,
            background: '#3b82f6',
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
            marginBottom: 16,
          }}
        >
          ✨
        </div>

        {TAB_CONFIG.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            title={tab.label}
            style={{
              width: 48,
              height: 48,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              borderRadius: 10,
              border: 'none',
              background: activeTab === tab.id ? '#3b82f6' : 'transparent',
              color: activeTab === tab.id ? '#fff' : '#94a3b8',
              cursor: 'pointer',
              fontSize: 20,
              transition: 'all 0.15s',
            }}
          >
            {tab.icon}
          </button>
        ))}

        {/* Logout button (bottom) */}
        <div style={{ flex: 1 }} />
        <button
          title="Sign out"
          onClick={() => {
            localStorage.removeItem('token');
            setToken('');
          }}
          style={{
            width: 48,
            height: 48,
            borderRadius: 10,
            border: 'none',
            background: 'transparent',
            color: '#64748b',
            cursor: 'pointer',
            fontSize: 20,
            marginBottom: 8,
          }}
        >
          ↩
        </button>
      </nav>

      {/* Main content area */}
      <main style={{ flex: 1, overflow: 'hidden', background: '#f8fafc' }}>
        {/* Top title bar */}
        <div
          style={{
            padding: '12px 24px',
            background: '#fff',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span style={{ fontSize: 18 }}>
            {TAB_CONFIG.find((t) => t.id === activeTab)?.icon}
          </span>
          <span style={{ fontWeight: 500, fontSize: 15 }}>
            {TAB_CONFIG.find((t) => t.id === activeTab)?.label}
          </span>
        </div>

        {/* Content: chat manages its own scrolling; other tabs scroll at the outer level */}
        <div
          style={{
            height: 'calc(100vh - 49px)',
            overflowY: activeTab === 'chat' ? 'hidden' : 'auto',
          }}
        >
          {activeTab === 'chat' && <ChatInterface />}
          {activeTab === 'rag' && <KnowledgeBasePage kbId="default" />}
          {activeTab === 'agent' && <MultiAgentPanel />}
          {activeTab === 'multimodal' && <MultimodalInput />}
          {activeTab === 'mcp' && <MCPPanel />}
          {activeTab === 'docs' && <DocumentUpload />}
        </div>
      </main>
    </div>
  );
}
// #endbook
