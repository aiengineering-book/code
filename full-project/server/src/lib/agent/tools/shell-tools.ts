// #book-ref ch17-coding-agent/server/src/lib/agent/tools/shell-tools.ts
// #book-ref ch16-multi-agent/server/src/lib/agent/tools/shell-tools.ts
// Stub: full implementation in ch15
import type { Tool } from '../react-agent.js';

export const runNodeCodeTool: Tool = {
  name: 'run_node_code',
    description: 'Execute code in a Node.js sandbox',
  inputSchema: {
    type: 'object',
    properties: { code: { type: 'string' } },
    required: ['code'],
  },
    execute: async () => 'stub: not implemented',
};
