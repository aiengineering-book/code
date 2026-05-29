// #book-ref ch20-mcp-tool-adapter
import type { Tool } from '../agent/react-agent.js';
import type { ManagedTool } from './manager.js';
import { mcpManager } from './manager.js';
import { checkPermission } from './permissions.js';

/**
 * 将 MCP 工具转换为 ReActAgent 可用的 Tool 格式
 */
export function adaptMCPToolsForAgent(
  managedTools: ManagedTool[],
  options: {
    userRole: 'viewer' | 'editor' | 'admin';
    onPermissionDenied?: (toolName: string, reason: string) => void;
    onConfirmationRequired?: (
      toolName: string,
      args: Record<string, unknown>,
      reason: string,
    ) => Promise<boolean>;
  },
): Tool[] {
  return managedTools
    .filter((mt) => {
      // 过滤掉无权限的工具
      const permission = checkPermission(mt.tool.name, options.userRole);
      if (!permission.allowed) {
        options.onPermissionDenied?.(mt.tool.name, permission.reason);
        return false;
      }
      return true;
    })
    .map(
      (mt): Tool => ({
        name: mt.tool.name,
        description: mt.tool.description,
        inputSchema: {
          type: 'object',
          properties: mt.tool.inputSchema.properties as Record<
            string,
            {
              type: string;
              description: string;
            }
          >,
          required: (mt.tool.inputSchema.required as string[]) ?? [],
        },
        execute: async (args) => {
          const typedArgs = args as Record<string, unknown>;
          const permission = checkPermission(mt.tool.name, options.userRole);

          // 需要用户确认
          if (
            permission.requiresConfirmation &&
            options.onConfirmationRequired
          ) {
            const confirmed = await options.onConfirmationRequired(
              mt.tool.name,
              typedArgs,
              permission.reason,
            );

            if (!confirmed) {
              return `操作已取消：用户拒绝了对 "${mt.tool.name}" 的授权`;
            }
          }

          return mcpManager.callTool(mt.tool.name, typedArgs);
        },
      }),
    );
}
// #endbook-ref
