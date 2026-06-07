// #book ch15-shell-tools
// ch15-browser-tools/server/src/lib/agent/tools/shell-tools.ts
import { exec } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { runInNewContext } from 'node:vm';
import type { Tool } from '../react-agent.js';
import { SANDBOX_ROOT } from './sandbox.js';

const execAsync = promisify(exec);

// Whitelist: only allow safe read-only commands and common dev tools
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

// Dangerous pattern blocklist (rejected even if the base command is whitelisted)
const BLOCKED_PATTERNS = [
  /rm\s+-rf/,        // Recursive delete
  />\s*\/dev\/sd/,   // Write to disk device
  /mkfs/,            // Format filesystem
  /dd\s+if/,         // Disk operations
  /:(){ :|:& };:/,   // Fork bomb
  /curl.*\|.*sh/,    // Pipe remote script execution
  /wget.*\|.*sh/,
  /chmod\s+777/,     // Dangerous permissions
  /sudo/,            // Privilege escalation
];

export const executeCommandTool: Tool = {
  name: 'execute_command',
  description: `Execute a command in the working directory. Only safe commands are allowed:
${[...ALLOWED_COMMANDS].join(', ')}
Commands run in the sandbox directory with a 30-second timeout.`,
  inputSchema: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'Command to execute',
      },
      workDir: {
        type: 'string',
        description: 'Working directory relative to the sandbox root, defaults to root',
      },
    },
    required: ['command'],
  },
  execute: async (input) => {
    const { command, workDir = '.' } = input as {
      command: string;
      workDir?: string;
    };

    // Security check 1: blocklist patterns
    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(command)) {
        return `Error: command contains dangerous operations and has been rejected`;
      }
    }

    // Security check 2: whitelist — only allow known safe commands
    const baseCommand = command.trim().split(/\s+/)[0] ?? '';
    if (!ALLOWED_COMMANDS.has(baseCommand)) {
      return `Error: command "${baseCommand}" is not in the allow list. Allowed: ${[...ALLOWED_COMMANDS].join(', ')}`;
    }

    // Resolve working directory (must stay within sandbox)
    let cwd: string;
    try {
      cwd = path.resolve(SANDBOX_ROOT, workDir);
      if (!cwd.startsWith(SANDBOX_ROOT)) {
        return 'Error: working directory is outside the sandbox';
      }
    } catch {
      return 'Error: invalid working directory';
    }

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd,
        timeout: 30_000,
        maxBuffer: 1024 * 1024, // 1 MB output limit
        env: {
          ...process.env,
          // Restrict PATH to prevent unexpected system command execution
          PATH: '/usr/local/bin:/usr/bin:/bin',
        },
      });

      const output = [
        stdout.trim() && `Output:\n${stdout.trim().slice(0, 3000)}`,
        stderr.trim() && `Stderr:\n${stderr.trim().slice(0, 500)}`,
      ]
        .filter(Boolean)
        .join('\n');

      return output || 'Command executed successfully (no output)';
    } catch (error) {
      const err = error as {
        killed?: boolean;
        code?: number;
        stderr?: string;
        message?: string;
      };

      if (err.killed) {
        return 'Error: command timed out (30 seconds)';
      }

      return [
        `Command failed (exit code ${err.code})`,
        err.stderr && `Error output: ${err.stderr.slice(0, 500)}`,
      ]
        .filter(Boolean)
        .join('\n');
    }
  },
};
// #endbook

// #book ch15-run-node-code
// ch15-browser-tools/server/src/lib/agent/tools/shell-tools.ts
/**
 * JavaScript code execution (isolated with vm module)
 */
export const runNodeCodeTool: Tool = {
  name: 'run_node_code',
  description:
    'Execute a JavaScript snippet and return the result. Good for math, data processing, and string manipulation.',
  inputSchema: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'JavaScript code — the value of the last expression is returned',
      },
    },
    required: ['code'],
  },
  execute: async (input) => {
    const { code } = input as { code: string };

    // Block access to file system and network using word-boundary checks
    // to avoid false positives on variable names like require_id or fetchData
    const forbidden = [
      'require',
      'import',
      'fetch',
      'XMLHttpRequest',
      '__dirname',
      'process',
    ];
    for (const word of forbidden) {
      if (new RegExp(`\\b${word}\\b`).test(code)) {
        return `Error: "${word}" is not allowed in code execution`;
      }
    }

    try {
      const logs: string[] = [];

      // Sandbox context: only expose safe built-ins
      // runInNewContext runs in an isolated V8 context — no access to host process globals
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
        timeout: 5000, // 5-second timeout to prevent infinite loops
      });

      return [
        logs.length > 0 && `Console output:\n${logs.join('\n')}`,
        `Return value: ${JSON.stringify(result, null, 2)}`,
      ]
        .filter(Boolean)
        .join('\n\n');
    } catch (error) {
      return `Execution error: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
};
// #endbook
