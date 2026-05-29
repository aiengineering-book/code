// #book ch20-mcp-panel
// ch20-mcp-client/web/src/components/MCPPanel.tsx
import { useEffect, useState } from 'react';
import { getToken } from '../lib/api.js';

interface ServerStatus {
  name: string;
  connected: boolean;
  toolCount: number;
  resourceCount: number;
  error?: string;
}

interface MCPTool {
  name: string;
  description: string;
  server: string;
}

export function MCPPanel() {
  const [servers, setServers] = useState<ServerStatus[]>([]);
  const [tools, setTools] = useState<MCPTool[]>([]);
  const [task, setTask] = useState('');
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<string[]>([]);
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const headers = { Authorization: `Bearer ${getToken()}` };

    fetch('/api/mcp/status', { headers })
      .then((r) => r.json())
      .then(setServers);

    fetch('/api/mcp/tools', { headers })
      .then((r) => r.json())
      .then(setTools);
  }, []);

  async function runAgentWithMCP() {
    if (!task.trim() || running) return;
    setRunning(true);
    setSteps([]);
    setAnswer('');
    setError('');

    const res = await fetch('/api/mcp/agent/run', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify({ task }),
    });

    if (!res.body) {
      setRunning(false);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      let currentEvent = ''; // Track the current event type
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice('event: '.length).trim();
          continue;
        }
        if (!line.startsWith('data: ')) {
          if (line === '') currentEvent = ''; // Empty line ends an event, reset
          continue;
        }

        try {
          const data = JSON.parse(line.slice(6));
          if (data.content) {
            setSteps((p) => [
              ...p,
              `[${data.type}] ${data.content.slice(0, 80)}`,
            ]);
          }
          if (data.answer) {
            setAnswer(data.answer);
            setRunning(false);
          }
          if (data.message && currentEvent === 'error') {
            setError(data.message);
          }
        } catch (err) {
          console.warn(`failed`, err);
        }
      }
    }

    setRunning(false);
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1rem' }}>
      <h2>MCP Tool Integration</h2>

      {/* Server status */}
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 14, color: '#6b7280', marginBottom: 8 }}>
          Connected MCP Servers
        </h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {servers.map((s) => (
            <div
              key={s.name}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid',
                borderColor: s.connected ? '#bbf7d0' : '#fca5a5',
                background: s.connected ? '#f0fdf4' : '#fff1f2',
                fontSize: 13,
              }}
            >
              <span style={{ marginRight: 6 }}>
                {s.connected ? '🟢' : '🔴'}
              </span>
              <span style={{ fontWeight: 500 }}>{s.name}</span>
              {s.connected && (
                <span style={{ color: '#6b7280', marginLeft: 6 }}>
                  {s.toolCount} tools
                </span>
              )}
              {s.error && (
                <span style={{ color: '#dc2626', marginLeft: 6 }}>
                  {s.error.slice(0, 30)}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Available tools */}
      {tools.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 14, color: '#6b7280', marginBottom: 8 }}>
            Available tools ({tools.length})
          </h3>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: 8,
            }}
          >
            {tools.map((t) => (
              <div
                key={t.name}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #e5e7eb',
                  borderRadius: 6,
                  fontSize: 13,
                }}
              >
                <div style={{ fontWeight: 500, marginBottom: 2 }}>{t.name}</div>
                <div style={{ color: '#6b7280', fontSize: 12 }}>
                  {t.description.slice(0, 60)}
                  {t.description.length > 60 ? '...' : ''}
                </div>
                <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 4 }}>
                  From: {t.server}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Agent run */}
      <div style={{ marginBottom: 16 }}>
        <textarea
          value={task}
          onChange={(e) => setTask(e.target.value)}
          placeholder="Enter a task — the Agent will use all available MCP tools to complete it..."
          rows={3}
          style={{
            width: '100%',
            padding: '10px',
            border: '1px solid #d1d5db',
            borderRadius: 8,
            fontSize: 14,
            resize: 'vertical',
            boxSizing: 'border-box',
          }}
        />
        <button
          onClick={runAgentWithMCP}
          disabled={running || !task.trim()}
          style={{
            marginTop: 8,
            padding: '8px 20px',
            background: running || !task.trim() ? '#e5e7eb' : '#2563eb',
            color: running || !task.trim() ? '#9ca3af' : '#fff',
            border: 'none',
            borderRadius: 8,
            cursor: running || !task.trim() ? 'not-allowed' : 'pointer',
          }}
        >
          {running ? 'Running...' : 'Run Agent'}
        </button>
      </div>

      {/* Execution steps */}
      {steps.length > 0 && (
        <div
          style={{
            padding: 12,
            background: '#1e293b',
            borderRadius: 8,
            marginBottom: 16,
            fontFamily: 'monospace',
            fontSize: 12,
            color: '#94a3b8',
            maxHeight: 180,
            overflowY: 'auto',
          }}
        >
          {steps.map((s, i) => (
            <div key={i}>{s}</div>
          ))}
        </div>
      )}

      {/* Final result */}
      {answer && (
        <div
          style={{
            padding: 16,
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: 8,
            fontSize: 14,
            lineHeight: 1.7,
            whiteSpace: 'pre-wrap',
          }}
        >
          {answer}
        </div>
      )}
      {/* Error message */}
      {error && (
        <div
          style={{
            padding: 16,
            background: '#dea891',
            border: '1px solid #bbf7d0',
            borderRadius: 8,
            fontSize: 14,
            lineHeight: 1.7,
            whiteSpace: 'pre-wrap',
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
// #endbook
