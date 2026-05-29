// #book ch20-mcp-manager
// ch20-mcp-client/server/src/lib/mcp/manager.ts
import { MCPClient, type MCPServerConfig } from './client.js';

export interface ManagedTool {
  serverName: string;
  tool: {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
  };
}

export class MCPManager {
  private clients = new Map<string, MCPClient>();
  private reconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();

  /**
   * Load and connect all MCP Servers from configuration
   */
  async loadFromConfig(configs: MCPServerConfig[]): Promise<void> {
    await Promise.allSettled(configs.map((config) => this.addServer(config)));
  }

  /**
   * Add and connect a single MCP Server
   */
  async addServer(config: MCPServerConfig): Promise<void> {
    if (this.clients.has(config.name)) {
      console.warn(`[MCP Manager] Server "${config.name}" already exists, skipping`);
      return;
    }

    const client = new MCPClient(config);
    this.clients.set(config.name, client);

    try {
      await client.connect();
    } catch (error) {
      console.error(
        `[MCP Manager] "${config.name}" connection failed:`,
        error instanceof Error ? error.message : error,
      );
      // Schedule auto-reconnect
      this.scheduleReconnect(config.name);
    }
  }

  /**
   * Get the tool list from all connected Servers (deduplicated + source-labelled)
   */
  getAllTools(): ManagedTool[] {
    const tools: ManagedTool[] = [];
    const toolNames = new Set<string>();

    for (const [serverName, client] of this.clients) {
      if (!client.isConnected) continue;

      for (const tool of client.tools) {
        // If the tool name conflicts, prefix with the Server name
        const uniqueName = toolNames.has(tool.name)
          ? `${serverName}__${tool.name}`
          : tool.name;

        toolNames.add(uniqueName);
        tools.push({
          serverName,
          tool: {
            name: uniqueName,
            description: `[${serverName}] ${tool.description}`,
            inputSchema: tool.inputSchema as Record<string, unknown>,
          },
        });
      }
    }

    return tools;
  }

  /**
   * Route a tool call to the corresponding Server
   */
  async callTool(
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<string> {
    // Handle prefix (serverName__toolName)
    let serverName: string | undefined;
    let actualToolName = toolName;

    if (toolName.includes('__')) {
      const parts = toolName.split('__');
      serverName = parts[0];
      actualToolName = parts.slice(1).join('__');
    }

    // Find the corresponding Client
    let client: MCPClient | undefined;

    if (serverName) {
      client = this.clients.get(serverName);
    } else {
      // Search all Servers for one that has this tool
      for (const [, c] of this.clients) {
        if (c.isConnected && c.tools.some((t) => t.name === toolName)) {
          client = c;
          break;
        }
      }
    }

    if (!client) {
      throw new Error(`No MCP Server found for tool "${toolName}"`);
    }

    if (!client.isConnected) {
      throw new Error(`MCP Server "${client.serverName}" is not connected`);
    }

    return client.callTool(actualToolName, args);
  }

  /**
   * Get the status of all Servers
   */
  getStatus(): Array<{
    name: string;
    connected: boolean;
    toolCount: number;
    resourceCount: number;
    error?: string | undefined;
  }> {
    return Array.from(this.clients.entries()).map(([name, client]) => ({
      name,
      connected: client.isConnected,
      toolCount: client.tools.length,
      resourceCount: client.resources.length,
      error: client.lastError,
    }));
  }

  /**
   * Disconnect and remove a Server
   */
  async removeServer(name: string): Promise<void> {
    const client = this.clients.get(name);
    if (!client) return;

    clearTimeout(this.reconnectTimers.get(name));
    this.reconnectTimers.delete(name);

    await client.disconnect().catch(() => {});
    this.clients.delete(name);
  }

  /**
   * Disconnect all connections
   */
  async disconnectAll(): Promise<void> {
    for (const timer of this.reconnectTimers.values()) {
      clearTimeout(timer);
    }
    this.reconnectTimers.clear();

    await Promise.allSettled(
      Array.from(this.clients.values()).map((c) => c.disconnect()),
    );
    this.clients.clear();
  }

  private scheduleReconnect(serverName: string, delayMs = 5000): void {
    const timer = setTimeout(async () => {
      const client = this.clients.get(serverName);
      if (!client) return;

      console.log(`[MCP Manager] Attempting to reconnect "${serverName}"...`);
      try {
        await client.connect();
      } catch {
        // Exponential backoff: 5s → 10s → 20s → max 60s
        const nextDelay = Math.min(delayMs * 2, 60_000);
        this.scheduleReconnect(serverName, nextDelay);
      }
    }, delayMs);

    this.reconnectTimers.set(serverName, timer);
  }
}

// Global singleton
export const mcpManager = new MCPManager();
// #endbook
