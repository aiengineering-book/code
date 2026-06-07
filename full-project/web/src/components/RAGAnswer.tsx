// #book-ref ch11-rag/web/src/components/RAGAnswer.tsx

import { useState } from 'react';

interface Citation {
  documentId: string;
  documentName: string;
  content: string;
  score: number;
}

interface RAGAnswerProps {
  answer: string;
  citations: Citation[];
  isStreaming?: boolean;
}

export function RAGAnswer({
  answer,
  citations,
  isStreaming = false,
}: RAGAnswerProps) {
  const [expanded, setExpanded] = useState<number | null>(null);

  // Render [Source N] as clickable superscripts
  const renderAnswer = (text: string) => {
    return text.split(/(\[Source \d+\])/g).map((part, i) => {
      const match = part.match(/\[Source (\d+)\]/);
      if (match) {
        const num = parseInt(match[1]!, 10) - 1;
        return (
          <sup
            key={i}
            onClick={() => setExpanded(expanded === num ? null : num)}
            style={{
              cursor: 'pointer',
              color: '#2563eb',
              fontWeight: 600,
              padding: '0 3px',
              borderRadius: 3,
              background: expanded === num ? '#dbeafe' : 'transparent',
            }}
          >
            [{num + 1}]
          </sup>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div>
      {/* Answer text */}
      <div style={{ fontSize: 15, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
        {renderAnswer(answer)}
        {isStreaming && (
          <span
            style={{
              display: 'inline-block',
              width: 2,
              height: '1em',
              background: 'currentColor',
              marginLeft: 2,
              verticalAlign: 'text-bottom',
              animation: 'blink 1s step-end infinite',
            }}
          />
        )}
      </div>

      {/* Expanded citation detail */}
      {expanded !== null && citations[expanded] && (
        <div
          style={{
            marginTop: 12,
            padding: '12px 16px',
            background: '#f0f9ff',
            border: '1px solid #bae6fd',
            borderRadius: 8,
            fontSize: 13,
          }}
        >
          <div style={{ fontWeight: 500, color: '#0369a1', marginBottom: 6 }}>
            📄 {citations[expanded]?.documentName}
          </div>
          <div style={{ color: '#0c4a6e', lineHeight: 1.7 }}>
            {citations[expanded]?.content}
          </div>
          <div style={{ marginTop: 8, color: '#64748b', fontSize: 12 }}>
            Relevance: {Math.round((citations[expanded]?.score ?? 0) * 100)}%
          </div>
        </div>
      )}

      {/* Source list */}
      {citations.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div
            style={{
              fontSize: 12,
              color: '#6b7280',
              fontWeight: 500,
              marginBottom: 8,
            }}
          >
            References
          </div>
          {citations.map((c, i) => (
            <div
              key={i}
              onClick={() => setExpanded(expanded === i ? null : i)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 10px',
                marginBottom: 6,
                border: '1px solid #e5e7eb',
                borderRadius: 6,
                cursor: 'pointer',
                background: expanded === i ? '#f0f9ff' : '#fff',
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#fff',
                  background: '#2563eb',
                  padding: '1px 6px',
                  borderRadius: 3,
                }}
              >
                {i + 1}
              </span>
              <span style={{ flex: 1, fontSize: 13, color: '#374151' }}>
                {c.documentName}
              </span>
              <span style={{ fontSize: 12, color: '#9ca3af' }}>
                {Math.round(c.score * 100)}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
