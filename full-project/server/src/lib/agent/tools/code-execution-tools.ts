// #book-ref ch17-code-execution-tools
import { exec } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import type { Tool } from '../react-agent.js';
import { resolveSandboxPath, SANDBOX_ROOT } from './sandbox.js';

const execAsync = promisify(exec);

/**
 * 工具：运行测试
 */
export const runTestsTool: Tool = {
  name: 'run_tests',
  description: '运行项目的单元测试，返回测试结果。支持 Vitest、Jest。',
  inputSchema: {
    type: 'object',
    properties: {
      testPattern: {
        type: 'string',
        description: '测试文件的匹配模式（可选），如 "src/utils/*.test.ts"',
      },
      testName: {
        type: 'string',
        description: '只运行名称包含此字符串的测试（可选）',
      },
      repoPath: {
        type: 'string',
        description: '项目路径',
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

    // 检测测试框架
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
        return '错误：未检测到测试框架（需要 vitest 或 jest）';
      }

      if (testPattern) testCommand += ` ${testPattern}`;
      if (testName) testCommand += ` -t "${testName}"`;
    } catch {
      return '错误：无法读取 package.json';
    }

    try {
      const { stdout, stderr } = await execAsync(testCommand, {
        cwd: repoPath,
        timeout: 120_000, // 测试超时 2 分钟
        maxBuffer: 5 * 1024 * 1024,
        env: { ...process.env, CI: 'true' }, // CI 模式下减少交互提示
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
      // 测试失败时 exit code 非 0，会抛出异常
      return [
        '测试执行结果（有失败）：',
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
 * 工具：静态代码分析
 */
export const lintCodeTool: Tool = {
  name: 'lint_code',
  description: '对代码文件进行静态分析，检查语法错误和代码规范问题。',
  inputSchema: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: '要分析的文件路径（相对于工作目录）',
      },
      repoPath: {
        type: 'string',
        description: '项目路径',
      },
    },
    required: ['filePath'],
  },
  execute: async (input) => {
    const { filePath, repoPath = SANDBOX_ROOT } = input as {
      filePath: string;
      repoPath?: string;
    };

    // 优先用 Biome，其次用 ESLint
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

      return stdout.trim() || stderr.trim() || '✅ 无 lint 问题';
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
 * 工具：生成并写入修复代码
 */
export const applyCodeFixTool: Tool = {
  name: 'apply_code_fix',
  description: '将修复后的代码写入文件（在沙箱工作区内，不影响真实代码库）。',
  inputSchema: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: '要修复的文件路径（相对于沙箱工作目录）',
      },
      fixedContent: {
        type: 'string',
        description: '修复后的完整文件内容',
      },
      description: {
        type: 'string',
        description: '本次修改的说明',
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

      // 备份原文件
      const backupPath = `${fullPath}.backup`;
      try {
        await fs.copyFile(fullPath, backupPath);
      } catch {
        // 原文件不存在，跳过备份
      }

      await fs.writeFile(fullPath, fixedContent, 'utf-8');

      return [
        `✅ 已写入修复代码：${filePath}`,
        `修改说明：${description}`,
        `文件大小：${Buffer.byteLength(fixedContent, 'utf-8')} 字节`,
      ].join('\n');
    } catch (error) {
      return `写入失败：${error instanceof Error ? error.message : String(error)}`;
    }
  },
};
// #endbook-ref
