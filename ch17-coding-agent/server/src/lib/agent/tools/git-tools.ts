// #book ch17-git-tools
// ch17-coding-agent/server/src/lib/agent/tools/git-tools.ts
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { Tool } from '../react-agent.js';

const execAsync = promisify(exec);

// Only read-only Git commands are permitted
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
    throw new Error(`Git command not in allowlist: ${args.split(/\s+/)[0]}`);
  }

  const { stdout, stderr } = await execAsync(`git ${args}`, {
    cwd: repoPath,
    timeout: 30_000,
    maxBuffer: 2 * 1024 * 1024,
  });

  return stdout.trim() || stderr.trim() || '(no output)';
}

/**
 * Tool: get Git diff
 */
export const gitDiffTool: Tool = {
  name: 'git_diff',
  description: 'Get Git code diff. Can compare branches, commits, or working tree changes.',
  inputSchema: {
    type: 'object',
    properties: {
      target: {
        type: 'string',
        description:
          'Comparison target, e.g. "HEAD~1" (previous commit), "main" (compare with main branch), empty (working tree changes)',
      },
      filePath: {
        type: 'string',
        description: 'Show diff for a specific file only (optional)',
      },
      repoPath: {
        type: 'string',
        description: 'Repository path (defaults to current working directory)',
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
      '--stat', // Show file change statistics
      target,
      filePath ? `-- ${filePath}` : '',
    ]
      .filter(Boolean)
      .join(' ');

    const stat = await runGit(args, repoPath);

    // Get detailed diff (line-limited)
    const detailArgs = ['diff', target, filePath ? `-- ${filePath}` : '']
      .filter(Boolean)
      .join(' ');

    const detail = await runGit(detailArgs, repoPath);
    const lines = detail.split('\n');
    const truncated = lines.length > 300;
    const preview = lines.slice(0, 300).join('\n');

    return [
      `=== Change Statistics ===\n${stat}`,
      `\n=== Detailed Diff ===\n${preview}`,
      truncated ? `\n...[truncated, ${lines.length} lines total]` : '',
    ].join('');
  },
};

/**
 * Tool: get commit history
 */
export const gitLogTool: Tool = {
  name: 'git_log',
  description: 'View Git commit history',
  inputSchema: {
    type: 'object',
    properties: {
      count: {
        type: 'string',
        description: 'Number of commits to show, default 10',
      },
      author: {
        type: 'string',
        description: 'Filter commits by a specific author',
      },
      repoPath: {
        type: 'string',
        description: 'Repository path',
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
 * Tool: view a specific version of a file
 */
export const gitShowTool: Tool = {
  name: 'git_show',
  description: 'View file contents at a specific commit or version',
  inputSchema: {
    type: 'object',
    properties: {
      ref: {
        type: 'string',
        description: 'Commit hash, branch name, or tag, e.g. "abc123" or "HEAD~1"',
      },
      filePath: {
        type: 'string',
        description: 'File path',
      },
      repoPath: {
        type: 'string',
        description: 'Repository path',
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
