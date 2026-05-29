// #book-ref ch10-document-upload
import { useCallback, useState } from 'react';
import { getToken } from '../lib/api.js';

interface Document {
  id: string;
  filename: string;
  status: 'pending' | 'processing' | 'ready' | 'failed';
  chunkCount?: number;
  errorMessage?: string;
}

export function DocumentUpload() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [_uploading, setUploading] = useState(false);

  // 轮询处理状态
  const pollStatus = useCallback(async (documentId: string) => {
    const POLL_INTERVAL = 2000; // 2 秒轮询一次

    const poll = async () => {
      const res = await fetch(`/api/documents/${documentId}/status`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data: Document = await res.json();

      setDocuments((prev) =>
        prev.map((d) => (d.id === documentId ? { ...d, ...data } : d)),
      );

      // 未完成则继续轮询
      if (data.status === 'pending' || data.status === 'processing') {
        setTimeout(poll, POLL_INTERVAL);
      }
    };

    setTimeout(poll, POLL_INTERVAL);
  }, []);

  // 上传文件
  const handleUpload = useCallback(
    async (file: File) => {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', file);

      try {
        const res = await fetch('/api/documents/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${getToken()}` },
          body: formData,
        });

        const { documentId } = await res.json();

        // 添加到列表，开始轮询状态
        const newDoc: Document = {
          id: documentId,
          filename: file.name,
          status: 'pending',
        };
        setDocuments((prev) => [newDoc, ...prev]);
        pollStatus(documentId);
      } finally {
        setUploading(false);
      }
    },
    [pollStatus],
  );

  // 拖拽上传
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleUpload(file);
    },
    [handleUpload],
  );

  const statusText: Record<Document['status'], string> = {
    pending: '等待处理',
    processing: '处理中...',
    ready: '已就绪',
    failed: '处理失败',
  };

  const statusColor: Record<Document['status'], string> = {
    pending: '#94a3b8',
    processing: '#3b82f6',
    ready: '#22c55e',
    failed: '#ef4444',
  };

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '2rem 1rem' }}>
      <h2>知识库文档</h2>

      {/* 上传区域 */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        style={{
          border: '2px dashed #d1d5db',
          borderRadius: 12,
          padding: '40px 24px',
          textAlign: 'center',
          marginBottom: 24,
          cursor: 'pointer',
          transition: 'border-color 0.2s',
        }}
        onClick={() => document.getElementById('file-input')?.click()}
      >
        <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
        <div style={{ fontSize: 15, color: '#374151', marginBottom: 4 }}>
          拖拽文件到此处，或点击选择文件
        </div>
        <div style={{ fontSize: 13, color: '#9ca3af' }}>
          支持 PDF、Markdown、HTML、TXT，最大 20MB
        </div>
        <input
          id="file-input"
          type="file"
          accept=".pdf,.md,.markdown,.html,.txt"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file);
          }}
        />
      </div>

      {/* 文档列表 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {documents.map((doc) => (
          <div
            key={doc.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 16px',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              background: '#fff',
            }}
          >
            <span style={{ fontSize: 20 }}>
              {doc.filename.endsWith('.pdf') ? '📕' : '📄'}
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#111827' }}>
                {doc.filename}
              </div>
              {doc.chunkCount && (
                <div style={{ fontSize: 12, color: '#6b7280' }}>
                  {doc.chunkCount} 个文本块
                </div>
              )}
              {doc.errorMessage && (
                <div style={{ fontSize: 12, color: '#ef4444' }}>
                  {doc.errorMessage}
                </div>
              )}
            </div>
            <span
              style={{
                fontSize: 12,
                padding: '2px 8px',
                borderRadius: 99,
                background: `${statusColor[doc.status]}20`,
                color: statusColor[doc.status],
                fontWeight: 500,
              }}
            >
              {statusText[doc.status]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
// #endbook-ref
