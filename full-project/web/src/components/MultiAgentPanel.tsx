// #book-ref ch16-multi-agent-panel
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

          if (data.type === 'planning') setPhase('📋 制定计划...');

          if (data.type === 'plan_ready' && data.plan?.tasks) {
            setPhase('🚀 开始执行');
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

          if (data.type === 'synthesizing') setPhase('✍️ 综合结果...');

          if (data.type === 'result') {
            setFinalAnswer(data.answer);
            setPhase('✅ 完成');
            setRunning(false);
          }

          if (data.type === 'error') {
            setPhase(`❌ 出错：${data.message}`);
            setRunning(false);
          }
        } catch {
          // 忽略解析错误
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
      <h2>多 Agent 任务系统</h2>
      <p style={{ color: '#6b7280', marginBottom: 24 }}>
        输入复杂目标，系统会自动分解为并行子任务执行
      </p>

      {/* 输入区域 */}
      <div style={{ marginBottom: 24 }}>
        <textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="例如：分析 TypeScript 最新版本的新特性，对比与上个版本的差异，并给出迁移建议"
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
          {running ? '执行中...' : '开始执行'}
        </button>
      </div>

      {/* 状态面板 */}
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

          {/* 任务列表 */}
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

      {/* 最终结果 */}
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
            综合分析结果
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
// #endbook-ref
