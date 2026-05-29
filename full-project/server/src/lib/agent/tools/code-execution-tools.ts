// #book-ref ch17-code-execution-tools
// ch17-coding-agent/server/src/lib/agent/tools/code-execution-tools.ts
import { exec } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import type { Tool } from '../react-agent.js';
import { resolveSandboxPath, SANDBOX_ROOT } from './sandbox.js';

const execAsync = promisify(exec);

/**
 * Tool: run tests
 */
export const runTestsTool: Tool = {
  name: 'run_tests',
  description: 'Run the project\'s unit tests and return the results. Supports Vitest and Jest.',
  inputSchema: {
    type: 'object',
    properties: {
      testPattern: {
        type: 'string',
        description: 'Test file glob pattern (optional), e.g. "src/utils/*.test.ts"',
      },
      testName: {
        type: 'string',
        description: 'Run only tests whose name contains this string (optional)',
      },
      repoPath: {
        type: 'string',
        description: 'Project path',
      },
    },
    required: [],
  },
  execute: async (input) => {
    const {
      testPattern = '',
      testName = '',
      repoPath = SANDBOX_ROOT,
    } = input as {
      testPattern?: string;
      testName?: string;
      repoPath?: string;
    };

    // Detect test framework
    let testCommand = '';
    try {
      const pkg = JSON.parse(
        await fs.readFile(path.join(repoPath, 'package.json'), 'utf-8'),
      );
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      if (deps.vitest) {
        testCommand = 'pnpm vitest run';
      } else if (deps.jest) {
        testCommand = 'pnpm jest --no-coverage';
      } else {
        return 'Error: no test framework detected (vitest or jest required)';
      }

      if (testPattern) testCommand += ` ${testPattern}`;
      if (testName) testCommand += ` -t "${testName}"`;
    } catch {
      return 'Error: unable to read package.json';
    }

    try {
      const { stdout, stderr } = await execAsync(testCommand, {
        cwd: repoPath,
        timeout: 120_000, // 2-minute test timeout
        maxBuffer: 5 * 1024 * 1024,
        env: { ...process.env, CI: 'true' }, // CI mode reduces interactive prompts
      });

      return [stdout.trim(), stderr.trim()]
        .filter(Boolean)
        .join('\n')
        .slice(0, 5000);
    } catch (error) {
      const err = error as {
        stdout?: string;
        stderr?: string;
        message?: string;
      };
      // Test failures exit with non-zero code, which throws an exception
      return [
        'Test execution result (with failures):',
        err.stdout?.trim(),
        err.stderr?.trim(),
      ]
        .filter(Boolean)
        .join('\n')
        .slice(0, 5000);
    }
  },
};

/**
 * Tool: static code analysis
 */
export const lintCodeTool: Tool = {
  name: 'lint_code',
  description: 'Perform static analysis on a code file, checking for syntax errors and style issues.',
  inputSchema: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: 'Path of the file to analyze (relative to working directory)',
      },
      repoPath: {
        type: 'string',
        description: 'Project path',
      },
    },
    required: ['filePath'],
  },
  execute: async (input) => {
    const { filePath, repoPath = SANDBOX_ROOT } = input as {
      filePath: string;
      repoPath?: string;
    };

    // Try Biome first, fall back to ESLint
    const hasBiome = await fs
      .access(path.join(repoPath, 'biome.json'))
      .then(() => true)
      .catch(() => false);

    const command = hasBiome
      ? `pnpm biome check ${filePath}`
      : `pnpm eslint ${filePath} --format=compact`;

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: repoPath,
        timeout: 30_000,
      });

      return stdout.trim() || stderr.trim() || '✅ No lint issues';
    } catch (error) {
      const err = error as { stdout?: string; stderr?: string };
      return [err.stdout?.trim(), err.stderr?.trim()]
        .filter(Boolean)
        .join('\n')
        .slice(0, 3000);
    }
  },
};

/**
 * Tool: generate and write fix code
 */
export const applyCodeFixTool: Tool = {
  name: 'apply_code_fix',
  description: 'Write fixed code to a file (in the sandbox workspace, does not affect the real codebase).',
  inputSchema: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: 'Path of the file to fix (relative to the sandbox working directory)',
      },
      fixedContent: {
        type: 'string',
        description: 'Complete fixed file content',
      },
      description: {
        type: 'string',
        description: 'Description of this change',
      },
    },
    required: ['filePath', 'fixedContent', 'description'],
  },
  execute: async (input) => {
    const { filePath, fixedContent, description } = input as {
      filePath: string;
      fixedContent: string;
      description: string;
    };

    try {
      const fullPath = resolveSandboxPath(filePath);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });

      // Back up the original file
      const backupPath = `${fullPath}.backup`;
      try {
        await fs.copyFile(fullPath, backupPath);
      } catch {
        // Original file doesn't exist, skip backup
      }

      await fs.writeFile(fullPath, fixedContent, 'utf-8');

      return [
        `✅ Fix written: ${filePath}`,
        `Change description: ${description}`,
        `File size: ${Buffer.byteLength(fixedContent, 'utf-8')} bytes`,
      ].join('\n');
    } catch (error) {
      return `Write failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
};
