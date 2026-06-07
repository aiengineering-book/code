// #book-ref ch15-browser-tools/server/src/lib/agent/tools/sandbox.ts

import fs from 'node:fs/promises';
import path from 'node:path';

// Agent can only operate files within this directory
const SANDBOX_ROOT =
  process.env.AGENT_SANDBOX_DIR ?? path.join(process.cwd(), 'agent-workspace');

/**
 * Resolve user-provided paths to within the sandbox directory.
 * Prevents path traversal attacks (e.g., ../../etc/passwd)
 */
export function resolveSandboxPath(userPath: string): string {
  // Resolve to an absolute path
  const resolved = path.resolve(SANDBOX_ROOT, userPath);

  // Verify the resolved path is inside the sandbox.
  // Add a trailing slash to prevent prefix collisions like /tmp/work vs /tmp/work-evil
  const sandboxPrefix = SANDBOX_ROOT.endsWith(path.sep)
    ? SANDBOX_ROOT
    : SANDBOX_ROOT + path.sep;

  if (resolved !== SANDBOX_ROOT && !resolved.startsWith(sandboxPrefix)) {
    throw new Error(`Path "${userPath}" is outside the working directory`);
  }

  return resolved;
}

/**
 * Ensure the sandbox directory exists
 */
export async function ensureSandbox(): Promise<void> {
  await fs.mkdir(SANDBOX_ROOT, { recursive: true });
}

export { SANDBOX_ROOT };
