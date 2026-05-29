// packages/server/src/lib/agent/agent-factory.ts
// #book ch13-agent-factory

// ch13-agent/server/src/lib/agent/agent-factory.ts
import { PlanAndExecuteAgent } from './plan-execute-agent.js';
import type { Tool } from './react-agent.js';
import { ReActAgent } from './react-agent.js';

// 通用工具集（后续章节会实现）
export const commonTools: Tool[] = [
  {
    name: 'web_search',
    description: '在网络上搜索信息',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '搜索关键词' },
      },
      required: ['query'],
    },
    execute: async ({ query }) => {
      // 第 15 章实现
      return `搜索结果：${query} 的相关信息...`;
    },
  },
  {
    name: 'calculate',
    description: '执行数学计算',
    parameters: {
      type: 'object',
      properties: {
        expression: {
          type: 'string',
          description: '数学表达式，如 "2 + 3 * 4"',
        },
      },
      required: ['expression'],
    },
    execute: async ({ expression }) => {
      try {
        // 注意：生产环境不能直接 eval，需要用安全的数学解析库
        // 此处仅作演示
        const result = Function(
          `"use strict"; return (${expression as string})`,
        )();
        return { result, expression };
      } catch {
        return { error: '无效的数学表达式' };
      }
    },
  },
  {
    name: 'get_current_time',
    description: '获取当前日期和时间',
    parameters: { type: 'object', properties: {} },
    execute: async () => ({
      datetime: new Date().toLocaleString('zh-CN'),
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
