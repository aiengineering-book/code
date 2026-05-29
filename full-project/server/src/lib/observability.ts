// #book-ref ch23-observability
import { Langfuse } from 'langfuse';
import { env } from '../env.js';

export const langfuse = new Langfuse({
  secretKey: env.LANGFUSE_SECRET_KEY,
  publicKey: env.LANGFUSE_PUBLIC_KEY,
  baseUrl: env.LANGFUSE_HOST ?? 'https://cloud.langfuse.com',
  // Flush interval (ms)
  flushAt: 15,
  flushInterval: 10_000,
} as any);

// Ensure all data is flushed on process exit
process.on('beforeExit', async () => {
  await langfuse.shutdownAsync();
});
// #endbook-ref
