// #book ch17-git-tools
import { exec } from 'node:child_process';
// ch17-coding-agent/server/src/lib/agent/tools/git-tools.ts
import { promisify } from 'node:util';
import type { Tool } from '../react-agent.js';

const execAsync = promisify(exec);

// 只允许只读的 Git 命令
const ALLOWED_GIT_COMMANDS = new Set([
  'status',
  'log',
  'diff',
  'show',
  'branch',
  'blame',
  'shortlog',
  'describe',
  'rev-parse',
]);

function validateGitCommand(args: string): boolean {
  const subCommand = args.trim().split(/\s+/)[0] ?? '';
  return ALLOWED_GIT_COMMANDS.has(subCommand);
}

async function runGit(args: string, repoPath: string): Promise<string> {
  if (!validateGitCommand(args)) {
    throw new Error(`Git 命令不在允许列表中：${args.split(/\s+/)[0]}`);
  }

  const { stdout, stderr } = await execAsync(`git ${args}`, {
    cwd: repoPath,
    timeout: 30_000,
    maxBuffer: 2 * 1024 * 1024,
  });

  return stdout.trim() || stderr.trim() || '（无输出）';
}

/**
 * 工具：获取 Git 差异
 */
export const gitDiffTool: Tool = {
  name: 'git_diff',
  description: '获取 Git 代码差异。可以比较分支、提交或工作区变更。',
  inputSchema: {
    type: 'object',
    properties: {
      target: {
        type: 'string',
        description:
          '比较目标，如 "HEAD~1"（上个提交）、"main"（与 main 分支对比）、留空（工作区变更）',
      },
      filePath: {
        type: 'string',
        description: '只显示特定文件的差异（可选）',
      },
      repoPath: {
        type: 'string',
        description: '仓库路径（默认为当前工作目录）',
      },
    },
    required: [],
  },
  execute: async (input) => {
    const {
      target = '',
      filePath = '',
      repoPath = process.cwd(),
    } = input as {
      target?: string;
      filePath?: string;
      repoPath?: string;
    };

    const args = [
      'diff',
      '--stat', // 显示文件变更统计
      target,
      filePath ? `-- ${filePath}` : '',
    ]
      .filter(Boolean)
      .join(' ');

    const stat = await runGit(args, repoPath);

    // 获取详细 diff（限制行数）
    const detailArgs = ['diff', target, filePath ? `-- ${filePath}` : '']
      .filter(Boolean)
      .join(' ');

    const detail = await runGit(detailArgs, repoPath);
    const lines = detail.split('\n');
    const truncated = lines.length > 300;
    const preview = lines.slice(0, 300).join('\n');

    return [
      `=== 变更统计 ===\n${stat}`,
      `\n=== 详细差异 ===\n${preview}`,
      truncated ? `\n...[已截断，共 ${lines.length} 行]` : '',
    ].join('');
  },
};

/**
 * 工具：获取提交历史
 */
export const gitLogTool: Tool = {
  name: 'git_log',
  description: '查看 Git 提交历史',
  inputSchema: {
    type: 'object',
    properties: {
      count: {
        type: 'string',
        description: '显示的提交数量，默认 10',
      },
      author: {
        type: 'string',
        description: '过滤特定作者的提交',
      },
      repoPath: {
        type: 'string',
        description: '仓库路径',
      },
    },
    required: [],
  },
  execute: async (input) => {
    const {
      count = '10',
      author = '',
      repoPath = process.cwd(),
    } = input as {
      count?: string;
      author?: string;
      repoPath?: string;
    };

    const args = [
      `log --oneline -${parseInt(count, 10) || 10}`,
      author ? `--author="${author}"` : '',
      '--no-merges',
    ]
      .filter(Boolean)
      .join(' ');

    return runGit(args, repoPath);
  },
};

/**
 * 工具：查看文件的特定版本
 */
export const gitShowTool: Tool = {
  name: 'git_show',
  description: '查看特定提交或版本的文件内容',
  inputSchema: {
    type: 'object',
    properties: {
      ref: {
        type: 'string',
        description: '提交哈希、分支名或标签，如 "abc123" 或 "HEAD~1"',
      },
      filePath: {
        type: 'string',
        description: '文件路径',
      },
      repoPath: {
        type: 'string',
        description: '仓库路径',
      },
    },
    required: ['ref', 'filePath'],
  },
  execute: async (input) => {
    const {
      ref,
      filePath,
      repoPath = process.cwd(),
    } = input as {
      ref: string;
      filePath: string;
      repoPath?: string;
    };

    return runGit(`show ${ref}:${filePath}`, repoPath);
  },
};
// #endbook
