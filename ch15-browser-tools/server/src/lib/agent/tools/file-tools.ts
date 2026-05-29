// #book ch15-file-tools
// ch15-browser-tools/server/src/lib/agent/tools/file-tools.ts
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Tool } from '../react-agent.js';
import { ensureSandbox, resolveSandboxPath, SANDBOX_ROOT } from './sandbox.js';

/**
 * Tool 1: Read a file
 */
export const readFileTool: Tool = {
  name: 'read_file',
  description: 'Read the contents of a file. Only files within the working directory are accessible.',
  inputSchema: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: 'File path relative to the working directory, e.g. "reports/q1.md"',
      },
      encoding: {
        type: 'string',
        description: 'File encoding, defaults to utf-8',
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

      // File size limit: 10 MB
      if (stat.size > 10 * 1024 * 1024) {
        return `Error: file too large (${(stat.size / 1024 / 1024).toFixed(1)}MB), maximum 10MB`;
      }

      const content = await fs.readFile(fullPath, encoding as BufferEncoding);
      const preview = content.toString().slice(0, 5000);
      const truncated = content.toString().length > 5000;

      return [
        `File: ${filePath}`,
        `Size: ${stat.size} bytes`,
        `Modified: ${stat.mtime.toLocaleString('en-US')}`,
        '',
        truncated
          ? `Content (first 5000 characters):\n${preview}\n...[truncated]`
          : `Content:\n${preview}`,
      ].join('\n');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return `Error: file not found "${filePath}"`;
      }
      return `Read failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
};

/**
 * Tool 2: Write a file
 */
export const writeFileTool: Tool = {
  name: 'write_file',
  description:
    'Create or overwrite a file. Parent directories are created automatically. Only operates within the working directory.',
  inputSchema: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: 'File path relative to the working directory',
      },
      content: {
        type: 'string',
        description: 'Content to write',
      },
      append: {
        type: 'string',
        description:
          'Whether to append to the file, "true" or "false", default "false" (overwrite)',
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

    // Content size limit: 5 MB
    if (content.length > 5 * 1024 * 1024) {
      return 'Error: content too large, maximum 5MB';
    }

    try {
      await ensureSandbox();
      const fullPath = resolveSandboxPath(filePath);

      // Create parent directories automatically
      await fs.mkdir(path.dirname(fullPath), { recursive: true });

      if (append === 'true') {
        await fs.appendFile(fullPath, content, 'utf-8');
        return `Appended ${content.length} characters to "${filePath}"`;
      } else {
        await fs.writeFile(fullPath, content, 'utf-8');
        return `Wrote "${filePath}" (${content.length} characters)`;
      }
    } catch (error) {
      return `Write failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
};

/**
 * Tool 3: List directory contents
 */
export const listDirectoryTool: Tool = {
  name: 'list_directory',
  description: 'List files and subdirectories in a directory.',
  inputSchema: {
    type: 'object',
    properties: {
      dirPath: {
        type: 'string',
        description: 'Directory path relative to the working directory, leave empty for root',
      },
      recursive: {
        type: 'string',
        description: 'Whether to list subdirectories recursively, "true" or "false", default "false"',
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
        return `Contents of "${dirPath}":\n${entries.join('\n')}`;
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

      return `"${dirPath}" — ${entries.length} items:\n${lines.join('\n')}`;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return `Error: directory not found "${dirPath}"`;
      }
      return `List failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
};

async function listRecursive(
  basePath: string,
  currentPath: string,
  depth: number,
  maxDepth = 3,
): Promise<string[]> {
  if (depth > maxDepth) return [`${'  '.repeat(depth)}...(max depth exceeded)`];

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
 * Tool 4: Search file contents
 */
export const searchInFilesTool: Tool = {
  name: 'search_in_files',
  description: 'Search files in the working directory for lines containing specific text.',
  inputSchema: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'Text or regex pattern to search for',
      },
      filePattern: {
        type: 'string',
        description: 'Restrict search to files with this extension, e.g. ".ts" or ".md" (optional)',
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
          // Skip common non-source directories
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
              results.push(`  Line ${lineNum}: ${line.trim().slice(0, 200)}`);
            });
            if (matches.length > 5) {
              results.push(`  ...(${matches.length - 5} more matches)`);
            }
          }
        } catch {
          // Skip unreadable files
        }
      }
    }

    try {
      await searchDir(SANDBOX_ROOT);
      if (results.length === 0) {
        return `No files found containing "${pattern}"`;
      }
      return `Search results:${results.join('\n')}`;
    } catch (error) {
      return `Search failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
};
// #endbook
