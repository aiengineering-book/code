// #book ch17-code-review-component
// ch17-coding-agent/web/src/components/CodeReview.tsx
import { useState } from 'react';
import { getToken } from '../lib/api.js';

interface Issue {
  severity: 'critical' | 'major' | 'minor' | 'suggestion';
  category: string;
  file: string;
  line: number | null;
  description: string;
  suggestion: string;
  fixedCode: string | null;
}

interface ReviewResult {
  summary: string;
  overallScore: number;
  issues: Issue[];
  positives: string[];
  testResults: { passed: number; failed: number; summary: string } | null;
  approved: boolean;
}

const severityConfig = {
  critical: { color: '#dc2626', bg: '#fef2f2', label: 'Critical' },
  major: { color: '#ea580c', bg: '#fff7ed', label: 'Major' },
  minor: { color: '#d97706', bg: '#fffbeb', label: 'Minor' },
  suggestion: { color: '#2563eb', bg: '#eff6ff', label: 'Suggestion' },
};

export function CodeReview() {
  const [repoPath, setRepoPath] = useState('');
  const [targetBranch, setTargetBranch] = useState('main');
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<string[]>([]);
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [expandedIssue, setExpandedIssue] = useState<number | null>(null);

  async function handleReview() {
    if (!repoPath.trim() || running) return;

    setRunning(true);
    setProgress([]);
    setResult(null);

    const res = await fetch('/api/code-review/review', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify({ repoPath, targetBranch }),
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
          if (data.message) {
            setProgress((prev) => [...prev.slice(-20), data.message]);
          }
          if (data.summary) {
            setResult(data);
            setRunning(false);
          }
          if (data.message?.includes('Review failed')) {
            setRunning(false);
          }
        } catch (err) {
          console.warn(`caught error:`, err);
        }
      }
    }

    setRunning(false);
  }

  const scoreColor = (score: number) =>
    score >= 8 ? '#16a34a' : score >= 6 ? '#d97706' : '#dc2626';

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1rem' }}>
      <h2>Code Review Agent</h2>

      {/* Configuration */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <input
          value={repoPath}
          onChange={(e) => setRepoPath(e.target.value)}
          placeholder="Repository path, e.g. /home/user/my-project"
          style={{
            flex: 1,
            padding: '8px 12px',
            border: '1px solid #d1d5db',
            borderRadius: 6,
          }}
        />
        <input
          value={targetBranch}
          onChange={(e) => setTargetBranch(e.target.value)}
          placeholder="Target branch (default: main)"
          style={{
            width: 160,
            padding: '8px 12px',
            border: '1px solid #d1d5db',
            borderRadius: 6,
          }}
        />
        <button
          onClick={handleReview}
          disabled={running || !repoPath.trim()}
          style={{
            padding: '8px 20px',
            background: running || !repoPath.trim() ? '#e5e7eb' : '#2563eb',
            color: running || !repoPath.trim() ? '#9ca3af' : '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: running || !repoPath.trim() ? 'not-allowed' : 'pointer',
            fontWeight: 500,
            whiteSpace: 'nowrap',
          }}
        >
          {running ? 'Reviewing...' : 'Start Review'}
        </button>
      </div>

      {/* Progress log */}
      {running && progress.length > 0 && (
        <div
          style={{
            padding: 12,
            background: '#1e293b',
            borderRadius: 8,
            marginBottom: 16,
            fontFamily: 'monospace',
            fontSize: 12,
            color: '#94a3b8',
            maxHeight: 200,
            overflowY: 'auto',
          }}
        >
          {progress.map((p, i) => (
            <div key={i} style={{ marginBottom: 2 }}>
              {p}
            </div>
          ))}
        </div>
      )}

      {/* Review result */}
      {result && (
        <div>
          {/* Summary */}
          <div
            style={{
              padding: 20,
              border: `2px solid ${result.approved ? '#bbf7d0' : '#fca5a5'}`,
              borderRadius: 12,
              background: result.approved ? '#f0fdf4' : '#fff1f2',
              marginBottom: 24,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                marginBottom: 12,
              }}
            >
              <span style={{ fontSize: 24 }}>
                {result.approved ? '✅' : '❌'}
              </span>
              <div>
                <div
                  style={{ fontSize: 16, fontWeight: 600, color: '#1e293b' }}
                >
                  {result.approved ? 'Approved for merge' : 'Changes requested'}
                </div>
                <div style={{ fontSize: 13, color: '#64748b' }}>
                  {result.summary}
                </div>
              </div>
              <div style={{ marginLeft: 'auto', textAlign: 'center' }}>
                <div
                  style={{
                    fontSize: 32,
                    fontWeight: 700,
                    color: scoreColor(result.overallScore),
                  }}
                >
                  {result.overallScore}
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>/ 10</div>
              </div>
            </div>

            {/* Test results */}
            {result.testResults && (
              <div style={{ fontSize: 13, color: '#374151' }}>
                🧪 Tests: {result.testResults.passed} passed / {result.testResults.failed} failed
                {' · '}
                {result.testResults.summary}
              </div>
            )}
          </div>

          {/* Issue list */}
          {result.issues.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 15, marginBottom: 12 }}>
                {result.issues.length} issue{result.issues.length !== 1 ? 's' : ''} found
              </h3>
              {result.issues.map((issue, i) => {
                const cfg = severityConfig[issue.severity];
                return (
                  <div
                    key={i}
                    style={{
                      border: `1px solid ${cfg.color}40`,
                      borderLeft: `3px solid ${cfg.color}`,
                      borderRadius: 8,
                      marginBottom: 8,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      onClick={() =>
                        setExpandedIssue(expandedIssue === i ? null : i)
                      }
                      style={{
                        padding: '10px 14px',
                        background: cfg.bg,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 11,
                          padding: '1px 6px',
                          background: cfg.color,
                          color: '#fff',
                          borderRadius: 3,
                          fontWeight: 600,
                          flexShrink: 0,
                        }}
                      >
                        {cfg.label}
                      </span>
                      <span
                        style={{
                          fontSize: 12,
                          color: '#64748b',
                          flexShrink: 0,
                        }}
                      >
                        {issue.file}
                        {issue.line ? `:${issue.line}` : ''}
                      </span>
                      <span style={{ fontSize: 13, color: '#1e293b', flex: 1 }}>
                        {issue.description}
                      </span>
                      <span style={{ fontSize: 12, color: '#94a3b8' }}>
                        {expandedIssue === i ? '▲' : '▼'}
                      </span>
                    </div>

                    {expandedIssue === i && (
                      <div style={{ padding: '12px 14px', background: '#fff' }}>
                        <div
                          style={{
                            fontSize: 13,
                            color: '#374151',
                            marginBottom: 8,
                          }}
                        >
                          💡 {issue.suggestion}
                        </div>
                        {issue.fixedCode && (
                          <pre
                            style={{
                              background: '#f8fafc',
                              padding: 12,
                              borderRadius: 6,
                              fontSize: 12,
                              overflow: 'auto',
                              border: '1px solid #e2e8f0',
                            }}
                          >
                            {issue.fixedCode}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Positives */}
          {result.positives.length > 0 && (
            <div>
              <h3 style={{ fontSize: 15, marginBottom: 8 }}>👍 What's done well</h3>
              {result.positives.map((p, i) => (
                <div
                  key={i}
                  style={{
                    padding: '6px 12px',
                    fontSize: 13,
                    color: '#166534',
                    background: '#f0fdf4',
                    borderRadius: 4,
                    marginBottom: 4,
                  }}
                >
                  ✓ {p}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
// #endbook
