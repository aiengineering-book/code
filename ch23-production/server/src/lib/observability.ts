// #book ch23-observability
import { Langfuse } from 'langfuse';
// ch23-production/server/src/lib/observability.ts
import { env } from '../env.js';

export const langfuse = new Langfuse({
  secretKey: env.LANGFUSE_SECRET_KEY,
  publicKey: env.LANGFUSE_PUBLIC_KEY,
  baseUrl: env.LANGFUSE_HOST ?? 'https://cloud.langfuse.com',
  // 请求刷新间隔（ms）
  flushAt: 15,
  flushInterval: 10_000,
} as any);

// 进程退出时确保所有数据上报
process.on('beforeExit', async () => {
  await langfuse.shutdownAsync();
});
// #endbook
