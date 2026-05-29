// #book-ref ch17-coding-agent/server/src/lib/agent/tools/file-tools.ts
// Stub: full implementation in ch15
import type { Tool } from '../react-agent.js';

export const readFileTool: Tool = {
  name: 'read_file',
    description: 'Read the contents of the specified file',
  inputSchema: {
    type: 'object',
    properties: { path: { type: 'string' } },
    required: ['path'],
  },
    execute: async () => 'stub: not implemented',
};

export const writeFileTool: Tool = {
  name: 'write_file',
    description: 'Write content to the specified file',
  inputSchema: {
    type: 'object',
    properties: { path: { type: 'string' }, content: { type: 'string' } },
    required: ['path', 'content'],
  },
    execute: async () => 'stub: not implemented',
};

export const listDirectoryTool: Tool = {
  name: 'list_directory',
    description: 'List files and subdirectories in a directory',
  inputSchema: {
    type: 'object',
    properties: { path: { type: 'string' } },
    required: ['path'],
  },
    execute: async () => 'stub: not implemented',
};

export const searchInFilesTool: Tool = {
  name: 'search_in_files',
    description: 'Search for specified content within a file',
  inputSchema: {
    type: 'object',
    properties: { pattern: { type: 'string' }, path: { type: 'string' } },
    required: ['pattern'],
  },
    execute: async () => 'stub: not implemented',
};
