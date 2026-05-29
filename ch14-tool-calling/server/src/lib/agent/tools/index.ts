// packages/server/src/lib/agent/tools/index.ts
// #book ch14-tools-index
import type { Tool } from '../react-agent.js';
// ch14-tool-calling/server/src/lib/agent/tools/index.ts
import { databaseQueryTool } from './data/database-tool.js';
import { WeatherTool } from './weather-tool.js';
import { webSearchTool } from './web/search-tool.js';

// 按权限分组的工具集
const VIEWER_TOOLS: Tool[] = [webSearchTool, new WeatherTool()];

const EDITOR_TOOLS: Tool[] = [
  ...VIEWER_TOOLS,
  databaseQueryTool,
  // 文件读取、内容创建等
];

const ADMIN_TOOLS: Tool[] = [
  ...EDITOR_TOOLS,
  // 数据库写入、发送邮件等高权限工具
];

export type UserRole = 'viewer' | 'editor' | 'admin';

/**
 * 根据用户角色返回对应的工具集
 */
export function getToolsForRole(role: UserRole): Tool[] {
  switch (role) {
    case 'admin':
      return ADMIN_TOOLS;
    case 'editor':
      return EDITOR_TOOLS;
    case 'viewer':
      return VIEWER_TOOLS;
    default:
      return VIEWER_TOOLS;
  }
}

/**
 * 根据场景返回特定工具集
 */
export function getToolsForScenario(scenario: string): Tool[] {
  const scenarios: Record<string, Tool[]> = {
    research: [webSearchTool, new WeatherTool()],
    data_analysis: [databaseQueryTool],
    customer_service: [webSearchTool, databaseQueryTool],
  };
  return scenarios[scenario] ?? VIEWER_TOOLS;
}
// #endbook
