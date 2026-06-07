// ch13-agent/server/src/lib/agent/agent-factory.ts
// #book ch13-agent-factory
// ch13-agent/server/src/lib/agent/agent-factory.ts

import { PlanAndExecuteAgent } from './plan-execute-agent.js';
import type { Tool } from './react-agent.js';
import { ReActAgent } from './react-agent.js';

// Common tool set (subsequent chapters implement the real versions)
export const commonTools: Tool[] = [
  {
    name: 'web_search',
    description: 'Search the web for information',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
      },
      required: ['query'],
    },
    execute: async ({ query }) => {
      // Implemented in Chapter 15
      return `Search results for: ${query}...`;
    },
  },
  {
    name: 'calculate',
    description: 'Perform mathematical calculations',
    parameters: {
      type: 'object',
      properties: {
        expression: {
          type: 'string',
          description: 'Math expression, e.g. "2 + 3 * 4"',
        },
      },
      required: ['expression'],
    },
    execute: async ({ expression }) => {
      try {
        // Note: never use eval directly in production — use a safe math parser
        // This is for demonstration only
        const result = Function(
          `"use strict"; return (${expression as string})`,
        )();
        return { result, expression };
      } catch {
        return { error: 'Invalid mathematical expression' };
      }
    },
  },
  {
    name: 'get_current_time',
    description: 'Get the current date and time',
    parameters: { type: 'object', properties: {} },
    execute: async () => ({
      datetime: new Date().toLocaleString('en-US'),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }),
  },
];

export function createResearchAgent(): ReActAgent {
  return new ReActAgent(commonTools);
}

export function createPlanningAgent(): PlanAndExecuteAgent {
  return new PlanAndExecuteAgent(commonTools);
}
// #endbook
