// #book-ref ch20-mcp-client
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type {
  Prompt,
  Resource,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';

export interface MCPServerConfig {
  name: string;
  // stdio 配置
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  // SSE 配置
  url?: string;
  // 通用配置
  timeout?: number;
}

export interface MCPClientState {
  connected: boolean;
  tools: Tool[];
  resources: Resource[];
  prompts: Prompt[];
  error?: string | undefined;
}

export class MCPClient {
  private client: Client;
  private transport:
    | StdioClientTransport
    | StreamableHTTPClientTransport
    | null = null;
  private state: MCPClientState = {
    connected: false,
    tools: [],
    resources: [],
    prompts: [],
  };

  constructor(private config: MCPServerConfig) {
    this.client = new Client(
      { name: 'ts-ai-host', version: '1.0.0' },
      {
        capabilities: {
          roots: { listChanged: true },
          sampling: {},
        },
      },
    );
  }

  /**
   * 连接到 MCP Server
   */
  async connect(): Promise<void> {
    try {
      if (this.config.url) {
        // Streamable HTTP 传输（远程 Server）
        this.transport = new StreamableHTTPClientTransport(
          new URL(this.config.url),
        );
      } else if (this.config.command) {
        // stdio 传输
        this.transport = new StdioClientTransport({
          command: this.config.command,
          args: this.config.args ?? [],
          env: { ...process.env, ...this.config.env } as Record<string, string>,
        });
      } else {
        throw new Error(`MCP Server "${this.config.name}" 未配置传输方式`);
      }

      await this.client.connect(this.transport as any);

      // 连接成功后拉取能力列表
      await this.refreshCapabilities();

      this.state.connected = true;
      this.state.error = undefined;

      console.log(
        `[MCP] 已连接 "${this.config.name}"，` +
          `工具: ${this.state.tools.length}，` +
          `资源: ${this.state.resources.length}，` +
          `提示: ${this.state.prompts.length}`,
      );
    } catch (error) {
      this.state.connected = false;
      this.state.error = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  /**
   * 刷新工具/资源/提示列表
   */
  async refreshCapabilities(): Promise<void> {
    const [toolsResult, resourcesResult, promptsResult] =
      await Promise.allSettled([
        this.client.listTools(),
        this.client.listResources(),
        this.client.listPrompts(),
      ]);

    this.state.tools =
      toolsResult.status === 'fulfilled' ? toolsResult.value.tools : [];

    this.state.resources =
      resourcesResult.status === 'fulfilled'
        ? resourcesResult.value.resources
        : [];

    this.state.prompts =
      promptsResult.status === 'fulfilled' ? promptsResult.value.prompts : [];
  }

  /**
   * 调用工具
   */
  async callTool(
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<string> {
    const result = await this.client.callTool({
      name: toolName,
      arguments: args,
    });

    // 提取文本内容
    const blocks = result.content as Array<{ type: string; text?: string }>;
    const textBlocks = blocks
      .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
      .map((b) => b.text);

    if (result.isError) {
      throw new Error(textBlocks.join('\n') || '工具执行失败');
    }

    return textBlocks.join('\n');
  }

  /**
   * 读取资源
   */
  async readResource(uri: string): Promise<string> {
    const result = await this.client.readResource({ uri });

    const contents = result.contents as Array<{
      uri: string;
      mimeType?: string;
      text?: string;
    }>;
    const textContent = contents
      .filter(
        (c): c is { uri: string; mimeType?: string; text: string } =>
          'text' in c,
      )
      .map((c) => c.text)
      .join('\n\n');

    return textContent;
  }

  /**
   * 获取提示模板
   */
  async getPrompt(name: string, args?: Record<string, string>) {
    return this.client.getPrompt({ name, arguments: args });
  }

  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    await this.client.close();
    this.state.connected = false;
    console.log(`[MCP] 已断开 "${this.config.name}"`);
  }

  get serverName() {
    return this.config.name;
  }
  get tools() {
    return this.state.tools;
  }
  get resources() {
    return this.state.resources;
  }
  get prompts() {
    return this.state.prompts;
  }
  get isConnected() {
    return this.state.connected;
  }
  get lastError() {
    return this.state.error;
  }
}
// #endbook-ref
