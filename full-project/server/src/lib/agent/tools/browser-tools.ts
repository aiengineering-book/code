// #book-ref ch16-multi-agent/server/src/lib/agent/tools/browser-tools.ts
// Stub: 完整实现见 ch15
import type { Tool } from '../react-agent.js';

export const fetchWebpageTool: Tool = {
  name: 'fetch_webpage',
  description: '访问指定 URL，提取网页的主要文本内容',
  inputSchema: {
    type: 'object',
    properties: { url: { type: 'string' } },
    required: ['url'],
  },
  execute: async () => 'stub: 未实现',
};
