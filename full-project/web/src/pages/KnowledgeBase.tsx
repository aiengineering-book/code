import { useState } from 'react';
import { RAGAnswer } from '../components/RAGAnswer.js';

interface Citation {
  documentId: string;
  documentName: string;
  content: string;
  score: number;
}

const token = localStorage.getItem('token') ?? '';
const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`,
};

export function KnowledgeBasePage(_props: { kbId: string }) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [citations, setCitations] = useState<Citation[]>([]);
  const [loading, setLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);

  async function handleQuery(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;

    setLoading(true);
    setAnswer('');
    setCitations([]);
    setIsStreaming(true);

    const res = await fetch('/api/rag/stream', {
      method: 'POST',
      headers,
      body: JSON.stringify({ question, limit: 5, useRerank: true }),
    });

    setLoading(false);

    if (!res.ok || !res.body) {
      setAnswer('Request failed. Please check that the backend service is running.');
      setIsStreaming(false);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });

      for (const line of buf.split('\n')) {
        if (line.startsWith('data: ')) {
          try {
            const payload = JSON.parse(line.slice(6));
            if (payload.citations) setCitations(payload.citations);
            if (payload.text) setAnswer((prev) => prev + payload.text);
          } catch {}
        }
      }
      buf = buf.includes('\n') ? buf.slice(buf.lastIndexOf('\n') + 1) : buf;
    }

    setIsStreaming(false);
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 20px' }}>
      <form
        onSubmit={handleQuery}
        style={{ display: 'flex', gap: 8, marginBottom: 24 }}
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask the knowledge base..."
          style={{
            flex: 1,
            padding: '10px 14px',
            border: '1px solid #d1d5db',
            borderRadius: 8,
            fontSize: 15,
            outline: 'none',
          }}
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          style={{
            padding: '10px 20px',
            background: '#3b82f6',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: 15,
            cursor: 'pointer',
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? 'Querying...' : 'Ask'}
        </button>
      </form>

      {(answer || isStreaming) && (
        <RAGAnswer
          answer={answer}
          citations={citations}
          isStreaming={isStreaming}
        />
      )}

      {!answer && !isStreaming && (
        <div
          style={{
            color: '#9ca3af',
            textAlign: 'center',
            marginTop: 60,
            fontSize: 14,
          }}
        >
          Upload documents first (Documents tab), then ask questions here
        </div>
      )}
    </div>
  );
}
