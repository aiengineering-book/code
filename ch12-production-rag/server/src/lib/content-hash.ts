// #book ch12-content-hash
import { createHash } from 'node:crypto';
// ch12-production-rag/server/src/lib/content-hash.ts

export function computeContentHash(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}
// #endbook
