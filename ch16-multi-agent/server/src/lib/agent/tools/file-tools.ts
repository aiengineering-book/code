// Stub: full implementation in ch15
import type { Tool } from '../react-agent.js';

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
