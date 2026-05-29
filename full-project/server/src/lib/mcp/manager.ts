// #book-ref ch20-mcp-manager
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
   * 从配置文件加载并连接所有 MCP Server
   */
  async loadFromConfig(configs: MCPServerConfig[]): Promise<void> {
    await Promise.allSettled(configs.map((config) => this.addServer(config)));
  }

  /**
   * 添加并连接单个 MCP Server
   */
  async addServer(config: MCPServerConfig): Promise<void> {
    if (this.clients.has(config.name)) {
      console.warn(`[MCP Manager] Server "${config.name}" 已存在，跳过`);
      return;
    }

    const client = new MCPClient(config);
    this.clients.set(config.name, client);

    try {
      await client.connect();
    } catch (error) {
      console.error(
        `[MCP Manager] "${config.name}" 连接失败：`,
        error instanceof Error ? error.message : error,
      );
      // 安排自动重连
      this.scheduleReconnect(config.name);
    }
  }

  /**
   * 获取所有已连接 Server 的工具列表（去重 + 标注来源）
   */
  getAllTools(): ManagedTool[] {
    const tools: ManagedTool[] = [];
    const toolNames = new Set<string>();

    for (const [serverName, client] of this.clients) {
      if (!client.isConnected) continue;

      for (const tool of client.tools) {
        // 如果工具名冲突，加上 Server 前缀
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
   * 路由工具调用到对应的 Server
   */
  async callTool(
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<string> {
    // 处理前缀（serverName__toolName）
    let serverName: string | undefined;
    let actualToolName = toolName;

    if (toolName.includes('__')) {
      const parts = toolName.split('__');
      serverName = parts[0];
      actualToolName = parts.slice(1).join('__');
    }

    // 找到对应的 Client
    let client: MCPClient | undefined;

    if (serverName) {
      client = this.clients.get(serverName);
    } else {
      // 在所有 Server 中查找拥有该工具的 Server
      for (const [, c] of this.clients) {
        if (c.isConnected && c.tools.some((t) => t.name === toolName)) {
          client = c;
          break;
        }
      }
    }

    if (!client) {
      throw new Error(`找不到工具 "${toolName}" 对应的 MCP Server`);
    }

    if (!client.isConnected) {
      throw new Error(`MCP Server "${client.serverName}" 未连接`);
    }

    return client.callTool(actualToolName, args);
  }

  /**
   * 获取所有 Server 的状态
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
   * 断开并移除 Server
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
   * 断开所有连接
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

      console.log(`[MCP Manager] 尝试重连 "${serverName}"...`);
      try {
        await client.connect();
      } catch {
        // 指数退避：5s → 10s → 20s → 最大 60s
        const nextDelay = Math.min(delayMs * 2, 60_000);
        this.scheduleReconnect(serverName, nextDelay);
      }
    }, delayMs);

    this.reconnectTimers.set(serverName, timer);
  }
}

// 全局单例
export const mcpManager = new MCPManager();
// #endbook-ref
