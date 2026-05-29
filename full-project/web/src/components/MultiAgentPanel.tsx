// #book-ref ch16-multi-agent-panel
// ch16-multi-agent/web/src/components/MultiAgentPanel.tsx
import { useState } from 'react';
import { getToken } from '../lib/api.js';

interface TaskStatus {
  taskId: string;
  title: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'timeout';
  output?: string;
  durationMs?: number;
}

export function MultiAgentPanel() {
  const [goal, setGoal] = useState('');
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<string>('');
  const [tasks, setTasks] = useState<TaskStatus[]>([]);
  const [finalAnswer, setFinalAnswer] = useState('');

  async function handleRun() {
    if (!goal.trim() || running) return;
    setRunning(true);
    setTasks([]);
    setFinalAnswer('');

    const res = await fetch('/api/multi-agent/orchestrate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify({ goal }),
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

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const data = JSON.parse(line.slice(6));

          if (data.type === 'planning') setPhase('📋 Forming plan...');

          if (data.type === 'plan_ready' && data.plan?.tasks) {
            setPhase('🚀 Execution started');
            setTasks(
              data.plan.tasks.map((t: { id: string; title: string }) => ({
                taskId: t.id,
                title: t.title,
                status: 'pending' as const,
              })),
            );
          }

          if (data.type === 'task_start') {
            setTasks((prev) =>
              prev.map((t) =>
                t.taskId === data.taskId
                  ? { ...t, status: 'running' as const }
                  : t,
              ),
            );
          }

          if (data.type === 'task_done') {
            setTasks((prev) =>
              prev.map((t) =>
                t.taskId === data.taskId
                  ? {
                      ...t,
                      status: data.result.status,
                      output: data.result.output,
                      durationMs: data.result.durationMs,
                    }
                  : t,
              ),
            );
          }

          if (data.type === 'synthesizing') setPhase('✍️ Synthesizing results...');

          if (data.type === 'result') {
            setFinalAnswer(data.answer);
            setPhase('✅ Complete');
            setRunning(false);
          }

          if (data.type === 'error') {
            setPhase(`❌ Error: ${data.message}`);
            setRunning(false);
          }
        } catch {
          // Ignore parse errors
        }
      }
    }

    setRunning(false);
  }

  const statusIcon: Record<TaskStatus['status'], string> = {
    pending: '⏳',
    running: '🔄',
    success: '✅',
    failed: '❌',
    timeout: '⏰',
  };

  const statusColor: Record<TaskStatus['status'], string> = {
    pending: '#94a3b8',
    running: '#3b82f6',
    success: '#22c55e',
    failed: '#ef4444',
    timeout: '#f59e0b',
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1rem' }}>
      <h2>Multi-Agent Task System</h2>
      <p style={{ color: '#6b7280', marginBottom: 24 }}>
        Enter a complex goal — the system will automatically decompose it into parallel subtasks
      </p>

      {/* Input area */}
      <div style={{ marginBottom: 24 }}>
        <textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="Example: Analyze the new features in the latest TypeScript release, compare with the previous version, and provide migration recommendations"
          rows={3}
          style={{
            width: '100%',
            padding: '12px',
            border: '1px solid #d1d5db',
            borderRadius: 8,
            fontSize: 14,
            resize: 'vertical',
            boxSizing: 'border-box',
          }}
        />
        <button
          onClick={handleRun}
          disabled={running || !goal.trim()}
          style={{
            marginTop: 8,
            padding: '10px 24px',
            background: running || !goal.trim() ? '#e5e7eb' : '#2563eb',
            color: running || !goal.trim() ? '#9ca3af' : '#fff',
            border: 'none',
            borderRadius: 8,
            cursor: running || !goal.trim() ? 'not-allowed' : 'pointer',
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          {running ? 'Running...' : 'Start'}
        </button>
      </div>

      {/* Status panel */}
      {(phase || tasks.length > 0) && (
        <div
          style={{
            padding: '16px',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            marginBottom: 24,
          }}
        >
          {phase && (
            <div
              style={{
                fontSize: 14,
                fontWeight: 500,
                marginBottom: tasks.length > 0 ? 16 : 0,
              }}
            >
              {phase}
            </div>
          )}

          {/* Task list */}
          {tasks.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {tasks.map((task) => (
                <div
                  key={task.taskId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    background: '#fff',
                    border: `1px solid ${statusColor[task.status]}40`,
                    borderLeft: `3px solid ${statusColor[task.status]}`,
                    borderRadius: 6,
                  }}
                >
                  <span style={{ fontSize: 16 }}>
                    {statusIcon[task.status]}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: '#1e293b',
                      }}
                    >
                      {task.title}
                    </div>
                    {task.output && task.status !== 'running' && (
                      <div
                        style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}
                      >
                        {task.output.slice(0, 120)}
                        {task.output.length > 120 ? '...' : ''}
                      </div>
                    )}
                  </div>
                  {task.durationMs && (
                    <div
                      style={{ fontSize: 12, color: '#94a3b8', flexShrink: 0 }}
                    >
                      {(task.durationMs / 1000).toFixed(1)}s
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Final result */}
      {finalAnswer && (
        <div
          style={{
            padding: '20px',
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: 12,
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: '#166534',
              marginBottom: 12,
            }}
          >
            Consolidated Analysis
          </div>
          <div
            style={{
              fontSize: 14,
              lineHeight: 1.8,
              whiteSpace: 'pre-wrap',
              color: '#1e293b',
            }}
          >
            {finalAnswer}
          </div>
        </div>
      )}
    </div>
  );
}
