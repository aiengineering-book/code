// Stub: 完整实现见 ch15
import type { Tool } from '../react-agent.js';

export const runNodeCodeTool: Tool = {
  name: 'run_node_code',
  description: '在 Node.js 沙箱中执行代码',
  inputSchema: {
    type: 'object',
    properties: { code: { type: 'string' } },
    required: ['code'],
  },
  execute: async () => 'stub: 未实现',
};
