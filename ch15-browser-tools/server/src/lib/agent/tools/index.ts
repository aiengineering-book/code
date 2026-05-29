// #book ch15-tools-index
// ch15-browser-tools/server/src/lib/agent/tools/index.ts
import type { Tool } from '../react-agent.js';

// Browser tools
export {
  fetchWebpageTool,
  interactWithPageTool,
  screenshotTool,
} from './browser-tools.js';

// File tools
export {
  listDirectoryTool,
  readFileTool,
  searchInFilesTool,
  writeFileTool,
} from './file-tools.js';

// Shell tools
export { executeCommandTool, runNodeCodeTool } from './shell-tools.js';

// Permission-based tool sets
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
