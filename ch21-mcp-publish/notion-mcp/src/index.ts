// #book ch21-notion-index
import {
// ch21-mcp-publish/notion-mcp/src/index.ts
  McpServer,
  ResourceTemplate,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { blocksToMarkdown } from './notion-client.js';
import { listNotionResources } from './resources.js';
import { notionTools } from './tools.js';

const server = new McpServer({ name: 'notion-mcp', version: '1.0.0' });

// Tools：逐个注册（McpServer 根据注册内容自动推断 capabilities）
for (const tool of notionTools) {
  console.error(`register tool ${tool.name}`);
  server.tool(tool.name, tool.description, tool.inputSchema, async (args) => {
    try {
      const result = await tool.execute(args);
      return { content: [{ type: 'text' as const, text: result }] };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      // Notion API 错误处理
      if (message.includes('Could not find page')) {
        return {
          content: [
            { type: 'text' as const, text: `错误：页面不存在或无访问权限` },
          ],
          isError: true,
        };
      }
      if (message.includes('unauthorized')) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `错误：Notion Token 无效或权限不足`,
            },
          ],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text' as const, text: `工具执行失败：${message}` }],
        isError: true,
      };
    }
  });
}

// Resources
// 静态列表：固定 URI，列出所有可用 Notion 页面
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

// 动态模板：notion://page/{pageId} 匹配任意页面 ID
server.resource(
  'notion-page-content',
  new ResourceTemplate('notion://page/{pageId}', { list: undefined }),
  async (uri) => {
    const match = uri.toString().match(/^notion:\/\/page\/(.+)$/);
    if (!match) {
      throw new McpError(ErrorCode.InvalidRequest, `无效的 Notion URI：${uri}`);
    }

    const pageId = match[1]!;
    const content = await blocksToMarkdown(pageId);

    return {
      contents: [
        {
          uri: uri.toString(),
          mimeType: 'text/markdown',
          text: content || '（页面内容为空）',
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
console.error('✅ Notion MCP Server 已启动');
// #endbook
