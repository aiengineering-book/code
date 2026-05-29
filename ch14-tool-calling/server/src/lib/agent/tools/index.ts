// packages/server/src/lib/agent/tools/index.ts
// #book ch14-tools-index
// ch14-tool-calling/server/src/lib/agent/tools/index.ts
import type { Tool } from '../react-agent.js';
import { databaseQueryTool } from './data/database-tool.js';
import { WeatherTool } from './weather-tool.js';
import { webSearchTool } from './web/search-tool.js';

// Tool sets grouped by permission level
const VIEWER_TOOLS: Tool[] = [webSearchTool, new WeatherTool()];

const EDITOR_TOOLS: Tool[] = [
  ...VIEWER_TOOLS,
  databaseQueryTool,
  // File reading, content creation, etc.
];

const ADMIN_TOOLS: Tool[] = [
  ...EDITOR_TOOLS,
  // Database writes, email sending, and other high-privilege tools
];

export type UserRole = 'viewer' | 'editor' | 'admin';

/**
 * Return the appropriate tool set for a user role
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
 * Return a tool set for a specific scenario
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
