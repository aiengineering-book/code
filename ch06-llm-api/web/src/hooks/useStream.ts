// #book ch06-useStream
import { useCallback, useRef, useState } from 'react';
// ch06-llm-api/web/src/hooks/useStream.ts

interface UseStreamOptions {
  onToken?: (token: string) => void;
  onComplete?: (stats: { inputTokens: number; outputTokens: number }) => void;
  onError?: (message: string) => void;
}

export function useStream(options: UseStreamOptions = {}) {
  const [streaming, setStreaming] = useState(false);
  const [text, setText] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const start = useCallback(
    async (
      messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    ) => {
      abortRef.current?.abort(); // 中止上一次未完成的流
      abortRef.current = new AbortController();
      setStreaming(true);
      setText('');

      try {
        const response = await fetch('/api/chat/stream', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
          },
          body: JSON.stringify({ messages }),
          signal: abortRef.current.signal,
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        if (!response.body) throw new Error('无响应体');

        // 读取 SSE 流
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? ''; // 最后一行可能不完整，留到下次处理

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const raw = line.slice(6).trim();
            if (!raw) continue;

            try {
              const parsed = JSON.parse(raw);
              if (parsed.text !== undefined) {
                setText((prev) => prev + parsed.text);
                options.onToken?.(parsed.text);
              } else if (parsed.inputTokens !== undefined) {
                options.onComplete?.({
                  inputTokens: parsed.inputTokens,
                  outputTokens: parsed.outputTokens,
                });
              } else if (parsed.message !== undefined) {
                options.onError?.(parsed.message);
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') {
          options.onError?.(error.message);
        }
      } finally {
        setStreaming(false);
      }
    },
    [options],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setStreaming(false);
  }, []);

  return { streaming, text, start, stop };
}
// #endbook
