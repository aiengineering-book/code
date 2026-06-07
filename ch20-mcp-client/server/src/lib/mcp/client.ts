// #book ch20-mcp-client
// ch20-mcp-client/server/src/lib/mcp/client.ts
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type {
  Prompt,
  Resource,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';

export interface MCPServerConfig {
  name: string;
  // stdio config
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  // SSE config
  url?: string;
  // General config
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
   * Connect to the MCP Server
   */
  async connect(): Promise<void> {
    try {
      if (this.config.url) {
        // Streamable HTTP transport (remote Server)
        this.transport = new StreamableHTTPClientTransport(
          new URL(this.config.url),
        );
      } else if (this.config.command) {
        // stdio transport
        this.transport = new StdioClientTransport({
          command: this.config.command,
          args: this.config.args ?? [],
          env: { ...process.env, ...this.config.env } as Record<string, string>,
        });
      } else {
        throw new Error(
          `MCP Server "${this.config.name}" has no transport configured`,
        );
      }

      // Cast needed: SDK's Transport interface uses exactOptionalPropertyTypes
      // but StreamableHTTPClientTransport.sessionId is typed as string | undefined.
      // This is an SDK type declaration issue, not a runtime incompatibility.
      await this.client.connect(this.transport as unknown as Transport);

      // Fetch capability lists after connecting
      await this.refreshCapabilities();

      this.state.connected = true;
      this.state.error = undefined;

      console.log(
        `[MCP] Connected "${this.config.name}", ` +
          `tools: ${this.state.tools.length}, ` +
          `resources: ${this.state.resources.length}, ` +
          `prompts: ${this.state.prompts.length}`,
      );
    } catch (error) {
      this.state.connected = false;
      this.state.error = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  /**
   * Refresh the tool/resource/prompt lists
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
   * Call a tool
   */
  async callTool(
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<string> {
    const result = await this.client.callTool({
      name: toolName,
      arguments: args,
    });

    // Extract text content
    const blocks = result.content as Array<{ type: string; text?: string }>;
    const textBlocks = blocks
      .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
      .map((b) => b.text);

    if (result.isError) {
      throw new Error(textBlocks.join('\n') || 'Tool execution failed');
    }

    return textBlocks.join('\n');
  }

  /**
   * Read a resource
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
   * Get a prompt template
   */
  async getPrompt(name: string, args?: Record<string, string>) {
    return this.client.getPrompt({ name, arguments: args });
  }

  /**
   * Disconnect
   */
  async disconnect(): Promise<void> {
    await this.client.close();
    this.state.connected = false;
    console.log(`[MCP] Disconnected "${this.config.name}"`);
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
// #endbook
