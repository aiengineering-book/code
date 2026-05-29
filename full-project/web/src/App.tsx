// #book ch24-app
import { useEffect, useState } from 'react';
import { ChatInterface } from './components/ChatInterface.js';
import { DocumentUpload } from './components/DocumentUpload.js';
import { MCPPanel } from './components/MCPPanel.js';
import { MultiAgentPanel } from './components/MultiAgentPanel.js';
import { MultimodalInput } from './components/MultimodalInput.js';
import { KnowledgeBasePage } from './pages/KnowledgeBase.js';

type Tab = 'chat' | 'rag' | 'agent' | 'multimodal' | 'mcp' | 'docs';

const TAB_CONFIG: Array<{ id: Tab; icon: string; label: string }> = [
  { id: 'chat', icon: '💬', label: '对话' },
  { id: 'rag', icon: '📚', label: '知识库' },
  { id: 'agent', icon: '🤖', label: 'Agent' },
  { id: 'multimodal', icon: '🎙️', label: '多模态' },
  { id: 'mcp', icon: '🔌', label: 'MCP 工具' },
  { id: 'docs', icon: '📄', label: '文档管理' },
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
      setError(data.error?.message ?? '失败');
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
            {mode === 'login' ? '登录' : '注册账号'}
          </h2>
        </div>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="邮箱"
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
          placeholder="密码"
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
          {mode === 'login' ? '登录' : '注册'}
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
          {mode === 'login' ? '没有账号？注册' : '已有账号？登录'}
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
      {/* 侧边导航 */}
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

        {/* 登出按钮（底部） */}
        <div style={{ flex: 1 }} />
        <button
          title="退出登录"
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

      {/* 主内容区 */}
      <main style={{ flex: 1, overflow: 'hidden', background: '#f8fafc' }}>
        {/* 顶部标题栏 */}
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

        {/* 内容区：chat 自己管滚动，其余 tab 外层滚 */}
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
