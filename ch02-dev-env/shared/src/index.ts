// #book ch02-shared-index
// 共享类型定义
// ch02-dev-env/shared/src/index.ts
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: Date;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

// 共享工具函数
export function formatDate(date: Date): string {
  if (Number.isNaN(date.getTime())) return 'Invalid Date';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function generateId(): string {
  return crypto.randomUUID();
}
// #endbook
