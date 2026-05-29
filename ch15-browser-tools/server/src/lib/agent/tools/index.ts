// #book ch15-tools-index
import type { Tool } from '../react-agent.js';
// ch15-browser-tools/server/src/lib/agent/tools/index.ts

// 浏览器工具
export {
  fetchWebpageTool,
  interactWithPageTool,
  screenshotTool,
} from './browser-tools.js';

// 文件工具
export {
  listDirectoryTool,
  readFileTool,
  searchInFilesTool,
  writeFileTool,
} from './file-tools.js';

// Shell 工具
export { executeCommandTool, runNodeCodeTool } from './shell-tools.js';

// 按角色权限的工具集
import {
  fetchWebpageTool,
  interactWithPageTool,
  screenshotTool,
} from './browser-tools.js';
import {
  listDirectoryTool,
  readFileTool,
  searchInFilesTool,
  writeFileTool,
} from './file-tools.js';
import { executeCommandTool, runNodeCodeTool } from './shell-tools.js';

export const VIEWER_TOOLS: Tool[] = [
  fetchWebpageTool,
  readFileTool,
  listDirectoryTool,
  searchInFilesTool,
];

export const EDITOR_TOOLS: Tool[] = [
  ...VIEWER_TOOLS,
  screenshotTool,
  writeFileTool,
  runNodeCodeTool,
];

export const ADMIN_TOOLS: Tool[] = [
  ...EDITOR_TOOLS,
  interactWithPageTool,
  executeCommandTool,
];

export function getToolsForRole(role: 'viewer' | 'editor' | 'admin'): Tool[] {
  switch (role) {
    case 'viewer':
      return VIEWER_TOOLS;
    case 'editor':
      return EDITOR_TOOLS;
    case 'admin':
      return ADMIN_TOOLS;
  }
}
// #endbook
