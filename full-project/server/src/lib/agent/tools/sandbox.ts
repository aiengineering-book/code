// #book-ref ch17-coding-agent/server/src/lib/agent/tools/sandbox.ts
// Stub: 完整实现见 ch15
import path from 'node:path';

export const SANDBOX_ROOT = '/tmp/agent-sandbox';

export function resolveSandboxPath(relativePath: string): string {
  const resolved = path.resolve(SANDBOX_ROOT, relativePath);
  if (!resolved.startsWith(SANDBOX_ROOT)) {
    throw new Error('路径越界：不允许访问沙箱外的文件');
  }
  return resolved;
}
