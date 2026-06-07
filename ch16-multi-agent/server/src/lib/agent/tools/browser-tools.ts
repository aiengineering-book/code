// Stub: full implementation in ch15
import type { Tool } from '../react-agent.js';

export const fetchWebpageTool: Tool = {
  name: 'fetch_webpage',
  description: 'Fetch the specified URL and extract its main text content',
  inputSchema: {
    type: 'object',
    properties: { url: { type: 'string' } },
    required: ['url'],
  },
  execute: async () => 'stub: not implemented',
};
