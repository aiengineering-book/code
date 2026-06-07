// #book-ref ch20-mcp-client/server/src/lib/mcp/mcp-tool-adapter.ts

import type { Tool } from '../agent/react-agent.js';
import type { ManagedTool } from './manager.js';
import { mcpManager } from './manager.js';
import { checkPermission } from './permissions.js';

/**
 * Convert MCP tools into the Tool format usable by ReActAgent
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
      // Filter out tools the user has no permission to use
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
          const permission = checkPermission(mt.tool.name, options.userRole);

          // Requires user confirmation
          if (
            permission.requiresConfirmation &&
            options.onConfirmationRequired
          ) {
            const confirmed = await options.onConfirmationRequired(
              mt.tool.name,
              args,
              permission.reason,
            );

            if (!confirmed) {
              return `Operation cancelled: user denied authorization for "${mt.tool.name}"`;
            }
          }

          return mcpManager.callTool(mt.tool.name, args);
        },
      }),
    );
}
