// #book-ref ch12-content-hash
import { createHash } from 'node:crypto';

export function computeContentHash(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}
// #endbook-ref
