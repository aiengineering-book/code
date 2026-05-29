// #book ch15-shell-tools
import { exec } from 'node:child_process';
// ch15-browser-tools/server/src/lib/agent/tools/shell-tools.ts
import path from 'node:path';
import { promisify } from 'node:util';
import { runInNewContext } from 'node:vm';
import type { Tool } from '../react-agent.js';
import { SANDBOX_ROOT } from './sandbox.js';

const execAsync = promisify(exec);

// 命令白名单：只允许安全的只读命令和常用开发工具
const ALLOWED_COMMANDS = new Set([
  'ls',
  'cat',
  'head',
  'tail',
  'grep',
  'find',
  'wc',
  'echo',
  'pwd',
  'date',
  'which',
  'node',
  'npx',
  'pnpm',
  'git',
  'curl',
  'wget',
  'python3',
  'python',
  'jq',
]);

// 危险命令黑名单（即使在白名单中也禁止）
const BLOCKED_PATTERNS = [
  /rm\s+-rf/, // 递归删除
  />\s*\/dev\/sd/, // 写入磁盘设备
  /mkfs/, // 格式化
  /dd\s+if/, // 磁盘操作
  /:(){ :|:& };:/, // fork 炸弹
  /curl.*\|.*sh/, // 管道执行远程脚本
  /wget.*\|.*sh/,
  /chmod\s+777/, // 危险权限
  /sudo/, // 提权
];

export const executeCommandTool: Tool = {
  name: 'execute_command',
  description: `在工作目录中执行命令。只允许安全的命令：
${[...ALLOWED_COMMANDS].join(', ')}
命令在沙箱目录中执行，超时 30 秒。`,
  inputSchema: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: '要执行的命令',
      },
      workDir: {
        type: 'string',
        description: '执行命令的目录（相对于工作目录），默认为根工作目录',
      },
    },
    required: ['command'],
  },
  execute: async (input) => {
    const { command, workDir = '.' } = input as {
      command: string;
      workDir?: string;
    };

    // 安全检查一：黑名单模式
    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(command)) {
        return `错误：命令包含危险操作，已拒绝执行`;
      }
    }

    // 安全检查二：白名单（只允许白名单中的命令）
    const baseCommand = command.trim().split(/\s+/)[0] ?? '';
    if (!ALLOWED_COMMANDS.has(baseCommand)) {
      return `错误：命令 "${baseCommand}" 不在允许列表中。允许的命令：${[...ALLOWED_COMMANDS].join(', ')}`;
    }

    // 解析工作目录（限制在沙箱内）
    let cwd: string;
    try {
      cwd = path.resolve(SANDBOX_ROOT, workDir);
      if (!cwd.startsWith(SANDBOX_ROOT)) {
        return '错误：工作目录超出沙箱范围';
      }
    } catch {
      return '错误：无效的工作目录';
    }

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd,
        timeout: 30_000,
        maxBuffer: 1024 * 1024, // 1MB 输出限制
        env: {
          ...process.env,
          // 限制 PATH，防止执行意外的系统命令
          PATH: '/usr/local/bin:/usr/bin:/bin',
        },
      });

      const output = [
        stdout.trim() && `输出：\n${stdout.trim().slice(0, 3000)}`,
        stderr.trim() && `错误输出：\n${stderr.trim().slice(0, 500)}`,
      ]
        .filter(Boolean)
        .join('\n');

      return output || '命令执行成功（无输出）';
    } catch (error) {
      const err = error as {
        killed?: boolean;
        code?: number;
        stderr?: string;
        message?: string;
      };

      if (err.killed) {
        return '错误：命令执行超时（30 秒）';
      }

      return [
        `命令执行失败（退出码 ${err.code}）`,
        err.stderr && `错误信息：${err.stderr.slice(0, 500)}`,
      ]
        .filter(Boolean)
        .join('\n');
    }
  },
};
// #endbook

// #book ch15-run-node-code
/**
// ch15-browser-tools/server/src/lib/agent/tools/shell-tools.ts
 * JS 代码执行工具（用 vm 模块隔离）
 */
export const runNodeCodeTool: Tool = {
  name: 'run_node_code',
  description:
    '执行 JavaScript 代码片段，返回执行结果。适合数学计算、数据处理等。',
  inputSchema: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'JavaScript 代码，最后一个表达式的值会被返回',
      },
    },
    required: ['code'],
  },
  execute: async (input) => {
    const { code } = input as { code: string };

    // 禁止访问文件系统和网络的关键词
    const forbidden = [
      'require',
      'import',
      'fetch',
      'XMLHttpRequest',
      '__dirname',
      'process',
    ];
    for (const word of forbidden) {
      if (code.includes(word)) {
        return `错误：代码中不允许使用 "${word}"`;
      }
    }

    try {
      const logs: string[] = [];

      // 构造沙箱上下文：只暴露安全的内置对象
      // runInNewContext 在独立的 V8 上下文中执行，无法访问宿主进程的全局变量
      const context = {
        console: {
          log: (...args: unknown[]) => logs.push(args.map(String).join(' ')),
          error: (...args: unknown[]) =>
            logs.push(`ERROR: ${args.map(String).join(' ')}`),
        },
        Math,
        JSON,
        Date,
        Array,
        Object,
        String,
        Number,
        Boolean,
        RegExp,
        parseInt,
        parseFloat,
        isNaN,
        isFinite,
      };

      const wrappedCode = `(function() { ${code} })()`;
      const result = runInNewContext(wrappedCode, context, {
        timeout: 5000, // 5 秒超时，防止死循环
      });

      return [
        logs.length > 0 && `控制台输出：\n${logs.join('\n')}`,
        `返回值：${JSON.stringify(result, null, 2)}`,
      ]
        .filter(Boolean)
        .join('\n\n');
    } catch (error) {
      return `执行错误：${error instanceof Error ? error.message : String(error)}`;
    }
  },
};
// #endbook
