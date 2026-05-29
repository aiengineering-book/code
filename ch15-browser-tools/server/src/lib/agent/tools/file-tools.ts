// #book ch15-file-tools
import fs from 'node:fs/promises';
// ch15-browser-tools/server/src/lib/agent/tools/file-tools.ts
import path from 'node:path';
import type { Tool } from '../react-agent.js';
import { ensureSandbox, resolveSandboxPath, SANDBOX_ROOT } from './sandbox.js';

/**
 * 工具一：读取文件
 */
export const readFileTool: Tool = {
  name: 'read_file',
  description: '读取指定文件的内容。只能访问工作目录内的文件。',
  inputSchema: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: '文件路径（相对于工作目录），如 "reports/2025-q1.md"',
      },
      encoding: {
        type: 'string',
        description: '文件编码，默认 utf-8',
        enum: ['utf-8', 'base64'],
      },
    },
    required: ['filePath'],
  },
  execute: async (input) => {
    const { filePath, encoding = 'utf-8' } = input as {
      filePath: string;
      encoding?: string;
    };

    try {
      const fullPath = resolveSandboxPath(filePath);
      const stat = await fs.stat(fullPath);

      // 文件大小限制：10MB
      if (stat.size > 10 * 1024 * 1024) {
        return `错误：文件过大（${(stat.size / 1024 / 1024).toFixed(1)}MB），最大支持 10MB`;
      }

      const content = await fs.readFile(fullPath, encoding as BufferEncoding);
      const preview = content.toString().slice(0, 5000);
      const truncated = content.toString().length > 5000;

      return [
        `文件：${filePath}`,
        `大小：${stat.size} 字节`,
        `修改时间：${stat.mtime.toLocaleString('zh-CN')}`,
        '',
        truncated
          ? `内容（前 5000 字符）：\n${preview}\n...[已截断]`
          : `内容：\n${preview}`,
      ].join('\n');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return `错误：文件不存在 "${filePath}"`;
      }
      return `读取失败：${error instanceof Error ? error.message : String(error)}`;
    }
  },
};

/**
 * 工具二：写入文件
 */
export const writeFileTool: Tool = {
  name: 'write_file',
  description:
    '创建或覆写文件。会自动创建不存在的父目录。只能在工作目录内操作。',
  inputSchema: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: '文件路径（相对于工作目录）',
      },
      content: {
        type: 'string',
        description: '要写入的文件内容',
      },
      append: {
        type: 'string',
        description:
          '是否追加到文件末尾，"true" 或 "false"，默认 "false"（覆写）',
        enum: ['true', 'false'],
      },
    },
    required: ['filePath', 'content'],
  },
  execute: async (input) => {
    const {
      filePath,
      content,
      append = 'false',
    } = input as {
      filePath: string;
      content: string;
      append?: string;
    };

    // 内容大小限制：5MB
    if (content.length > 5 * 1024 * 1024) {
      return '错误：内容过大，最大支持 5MB';
    }

    try {
      await ensureSandbox();
      const fullPath = resolveSandboxPath(filePath);

      // 自动创建父目录
      await fs.mkdir(path.dirname(fullPath), { recursive: true });

      if (append === 'true') {
        await fs.appendFile(fullPath, content, 'utf-8');
        return `已追加 ${content.length} 个字符到 "${filePath}"`;
      } else {
        await fs.writeFile(fullPath, content, 'utf-8');
        return `已写入 "${filePath}"（${content.length} 个字符）`;
      }
    } catch (error) {
      return `写入失败：${error instanceof Error ? error.message : String(error)}`;
    }
  },
};

/**
 * 工具三：列出目录内容
 */
export const listDirectoryTool: Tool = {
  name: 'list_directory',
  description: '列出目录内的文件和子目录。',
  inputSchema: {
    type: 'object',
    properties: {
      dirPath: {
        type: 'string',
        description: '目录路径（相对于工作目录），留空表示根目录',
      },
      recursive: {
        type: 'string',
        description: '是否递归列出子目录，"true" 或 "false"，默认 "false"',
        enum: ['true', 'false'],
      },
    },
    required: [],
  },
  execute: async (input) => {
    const { dirPath = '.', recursive = 'false' } = input as {
      dirPath?: string;
      recursive?: string;
    };

    try {
      const fullPath = resolveSandboxPath(dirPath);

      if (recursive === 'true') {
        const entries = await listRecursive(fullPath, fullPath, 0);
        return `目录 "${dirPath}" 的内容：\n${entries.join('\n')}`;
      }

      const entries = await fs.readdir(fullPath, { withFileTypes: true });
      const lines = await Promise.all(
        entries.map(async (entry) => {
          const entryPath = path.join(fullPath, entry.name);
          if (entry.isDirectory()) {
            return `📁 ${entry.name}/`;
          }
          const stat = await fs.stat(entryPath);
          const size =
            stat.size < 1024
              ? `${stat.size}B`
              : stat.size < 1024 * 1024
                ? `${(stat.size / 1024).toFixed(1)}KB`
                : `${(stat.size / 1024 / 1024).toFixed(1)}MB`;
          return `📄 ${entry.name} (${size})`;
        }),
      );

      return `目录 "${dirPath}" 共 ${entries.length} 项：\n${lines.join('\n')}`;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return `错误：目录不存在 "${dirPath}"`;
      }
      return `列目录失败：${error instanceof Error ? error.message : String(error)}`;
    }
  },
};

async function listRecursive(
  basePath: string,
  currentPath: string,
  depth: number,
  maxDepth = 3,
): Promise<string[]> {
  if (depth > maxDepth) return [`${'  '.repeat(depth)}...（超过最大深度）`];

  const entries = await fs.readdir(currentPath, { withFileTypes: true });
  const lines: string[] = [];

  for (const entry of entries) {
    const indent = '  '.repeat(depth);
    if (entry.isDirectory()) {
      lines.push(`${indent}📁 ${entry.name}/`);
      const subEntries = await listRecursive(
        basePath,
        path.join(currentPath, entry.name),
        depth + 1,
        maxDepth,
      );
      lines.push(...subEntries);
    } else {
      lines.push(`${indent}📄 ${entry.name}`);
    }
  }

  return lines;
}

/**
 * 工具四：搜索文件内容
 */
export const searchInFilesTool: Tool = {
  name: 'search_in_files',
  description: '在工作目录的文件中搜索包含特定文本的内容，返回匹配的行。',
  inputSchema: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: '要搜索的文本或正则表达式',
      },
      filePattern: {
        type: 'string',
        description: '限定搜索的文件扩展名，如 ".ts" ".md"（可选）',
      },
    },
    required: ['pattern'],
  },
  execute: async (input) => {
    const { pattern, filePattern } = input as {
      pattern: string;
      filePattern?: string;
    };

    const results: string[] = [];
    let regex: RegExp;

    try {
      regex = new RegExp(pattern, 'gi');
    } catch {
      regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    }

    async function searchDir(dirPath: string): Promise<void> {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          // 跳过 node_modules 等
          if (!['node_modules', '.git', 'dist', '.next'].includes(entry.name)) {
            await searchDir(fullPath);
          }
          continue;
        }

        if (filePattern && !entry.name.endsWith(filePattern)) continue;

        try {
          const content = await fs.readFile(fullPath, 'utf-8');
          const lines = content.split('\n');
          const matches = lines
            .map((line, i) => ({ line, lineNum: i + 1 }))
            .filter(({ line }) => regex.test(line));

          if (matches.length > 0) {
            const relPath = path.relative(SANDBOX_ROOT, fullPath);
            results.push(`\n📄 ${relPath}:`);
            matches.slice(0, 5).forEach(({ line, lineNum }) => {
              results.push(`  行 ${lineNum}: ${line.trim().slice(0, 200)}`);
            });
            if (matches.length > 5) {
              results.push(`  ...（还有 ${matches.length - 5} 处匹配）`);
            }
          }
        } catch {
          // 跳过无法读取的文件
        }
      }
    }

    try {
      await searchDir(SANDBOX_ROOT);
      if (results.length === 0) {
        return `未找到包含 "${pattern}" 的文件`;
      }
      return `搜索结果：${results.join('\n')}`;
    } catch (error) {
      return `搜索失败：${error instanceof Error ? error.message : String(error)}`;
    }
  },
};
// #endbook
