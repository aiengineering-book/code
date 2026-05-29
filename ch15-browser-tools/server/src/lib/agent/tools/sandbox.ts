// #book ch15-sandbox

// ch15-browser-tools/server/src/lib/agent/tools/sandbox.ts
import fs from 'node:fs/promises';
import path from 'node:path';

// Agent 只能在这个目录内操作文件
const SANDBOX_ROOT =
  process.env.AGENT_SANDBOX_DIR ?? path.join(process.cwd(), 'agent-workspace');

/**
 * 将用户输入的路径限制在沙箱目录内
 * 防止路径穿越攻击（如 ../../etc/passwd）
 */
export function resolveSandboxPath(userPath: string): string {
  // 解析为绝对路径
  const resolved = path.resolve(SANDBOX_ROOT, userPath);

  // 确保解析后的路径在沙箱目录内
  if (!resolved.startsWith(SANDBOX_ROOT)) {
    throw new Error(`路径 "${userPath}" 超出工作目录范围`);
  }

  return resolved;
}

/**
 * 确保沙箱目录存在
 */
export async function ensureSandbox(): Promise<void> {
  await fs.mkdir(SANDBOX_ROOT, { recursive: true });
}

export { SANDBOX_ROOT };
// #endbook
