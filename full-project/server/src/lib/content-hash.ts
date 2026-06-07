// #book-ref ch12-production-rag/server/src/lib/content-hash.ts

import { createHash } from 'node:crypto';

export function computeContentHash(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}
