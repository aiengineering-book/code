// #book-ref ch17-coding-agent/server/src/lib/agent/tools/sandbox.ts
// Stub: full implementation in ch15
import path from 'node:path';

export const SANDBOX_ROOT = '/tmp/agent-sandbox';

export function resolveSandboxPath(relativePath: string): string {
  const resolved = path.resolve(SANDBOX_ROOT, relativePath);
  if (!resolved.startsWith(SANDBOX_ROOT)) {
    throw new Error('Path traversal: access outside the sandbox is not allowed');
  }
  return resolved;
}
