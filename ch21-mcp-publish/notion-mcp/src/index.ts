// #book ch21-notion-index
// ch21-mcp-publish/notion-mcp/src/index.ts
import {
  McpServer,
  ResourceTemplate,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { blocksToMarkdown } from './notion-client.js';
import { listNotionResources } from './resources.js';
import { notionTools } from './tools.js';

const server = new McpServer({ name: 'notion-mcp', version: '1.0.0' });

// Tools: register one by one (McpServer infers capabilities from registrations)
for (const tool of notionTools) {
  console.error(`register tool ${tool.name}`);
  server.tool(tool.name, tool.description, tool.inputSchema, async (args) => {
    try {
      const result = await tool.execute(args);
      return { content: [{ type: 'text' as const, text: result }] };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      // Notion API error handling
      if (message.includes('Could not find page')) {
        return {
          content: [
            { type: 'text' as const, text: `Error: page not found or no access permission` },
          ],
          isError: true,
        };
      }
      if (message.includes('unauthorized')) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error: Notion token is invalid or has insufficient permissions`,
            },
          ],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text' as const, text: `Tool execution failed: ${message}` }],
        isError: true,
      };
    }
  });
}

// Resources
// Static list: fixed URI, lists all available Notion pages
server.resource('notion-pages', 'notion://pages', async () => {
  const resources = await listNotionResources().catch(() => []);
  return {
    contents: resources.map((r) => ({
      uri: r.uri,
      mimeType: 'text/markdown',
      text: r.name,
    })),
  };
});

// Dynamic template: notion://page/{pageId} matches any page ID
server.resource(
  'notion-page-content',
  new ResourceTemplate('notion://page/{pageId}', { list: undefined }),
  async (uri) => {
    const match = uri.toString().match(/^notion:\/\/page\/(.+)$/);
    if (!match) {
      throw new McpError(ErrorCode.InvalidRequest, `Invalid Notion URI: ${uri}`);
    }

    const pageId = match[1]!;
    const content = await blocksToMarkdown(pageId);

    return {
      contents: [
        {
          uri: uri.toString(),
          mimeType: 'text/markdown',
          text: content || '(Page content is empty)',
        },
      ],
    };
  },
);

server.server.onerror = (error) => {
  console.error('[Notion MCP]', error);
};

const transport = new StdioServerTransport();
await server.connect(transport);
console.error('✅ Notion MCP Server started');
// #endbook
