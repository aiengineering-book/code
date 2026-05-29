// #book-ref ch17-coding-agent/server/src/lib/agent/tools/file-tools.ts
// Stub: 完整实现见 ch15
import type { Tool } from '../react-agent.js';

export const readFileTool: Tool = {
  name: 'read_file',
  description: '读取指定文件的内容',
  inputSchema: {
    type: 'object',
    properties: { path: { type: 'string' } },
    required: ['path'],
  },
  execute: async () => 'stub: 未实现',
};

export const writeFileTool: Tool = {
  name: 'write_file',
  description: '将内容写入指定文件',
  inputSchema: {
    type: 'object',
    properties: { path: { type: 'string' }, content: { type: 'string' } },
    required: ['path', 'content'],
  },
  execute: async () => 'stub: 未实现',
};

export const listDirectoryTool: Tool = {
  name: 'list_directory',
  description: '列出目录下的文件和子目录',
  inputSchema: {
    type: 'object',
    properties: { path: { type: 'string' } },
    required: ['path'],
  },
  execute: async () => 'stub: 未实现',
};

export const searchInFilesTool: Tool = {
  name: 'search_in_files',
  description: '在文件中搜索指定内容',
  inputSchema: {
    type: 'object',
    properties: { pattern: { type: 'string' }, path: { type: 'string' } },
    required: ['pattern'],
  },
  execute: async () => 'stub: 未实现',
};
