// Stub: 完整实现见 ch15
import type { Tool } from '../react-agent.js';

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
