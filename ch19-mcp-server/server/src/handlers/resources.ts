// #book ch19-resources
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
// ch19-mcp-server/server/src/handlers/resources.ts
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';

// 静态资源定义
const _STATIC_RESOURCES = [
  {
    uri: 'knowledge-base://documents/list',
    name: '知识库文档目录',
    description: '当前知识库中所有已处理文档的列表',
    mimeType: 'application/json',
  },
  {
    uri: 'knowledge-base://stats',
    name: '知识库统计',
    description: '文档数量、向量块数量、最后更新时间等统计信息',
    mimeType: 'application/json',
  },
];

export function registerResourceHandlers(server: McpServer) {
  // 静态资源：知识库统计
  server.resource(
    'knowledge-base-stats',
    'knowledge-base://stats',
    {
      description: '文档数量、向量块数量、最后更新时间等统计信息',
      mimeType: 'application/json',
    },
    async (uri) => {
      const stats = await fetchStats();
      return {
        contents: [
          {
            uri: uri.toString(),
            mimeType: 'application/json',
            text: JSON.stringify(stats, null, 2),
          },
        ],
      };
    },
  );

  // 静态资源：文档列表
  server.resource(
    'knowledge-base-documents-list',
    'knowledge-base://documents/list',
    {
      description: '当前知识库中所有已处理文档的列表',
      mimeType: 'application/json',
    },
    async (uri) => {
      const response = await fetch('http://localhost:3000/api/documents');
      const docs = await response.json();
      return {
        contents: [
          {
            uri: uri.toString(),
            mimeType: 'application/json',
            text: JSON.stringify(docs, null, 2),
          },
        ],
      };
    },
  );

  // 动态资源：单个文档内容（使用 URI 模板）
  server.resource(
    'knowledge-base-document',
    new ResourceTemplate('knowledge-base://document/{documentId}', {
      // list 回调：返回所有已就绪文档的 URI
      list: async () => {
        const response = await fetch(
          'http://localhost:3000/api/documents',
        ).catch(() => null);
        const docs = response?.ok
          ? ((await response.json()) as Array<{
              id: string;
              filename: string;
              status: string;
            }>)
          : [];

        return {
          resources: docs
            .filter((d) => d.status === 'ready')
            .map((d) => ({
              uri: `knowledge-base://document/${d.id}`,
              name: d.filename,
              description: `文档内容：${d.filename}`,
              mimeType: 'text/plain' as const,
            })),
        };
      },
    }),
    { description: '知识库中单个文档的完整内容', mimeType: 'text/plain' },
    async (uri, { documentId }) => {
      const content = await fetchDocumentContent(documentId as string);
      return {
        contents: [
          {
            uri: uri.toString(),
            mimeType: 'text/plain',
            text: content,
          },
        ],
      };
    },
  );
}

async function fetchStats() {
  const response = await fetch('http://localhost:3000/api/documents').catch(
    () => null,
  );
  const docs = response?.ok
    ? ((await response.json()) as Array<{ status: string; chunkCount: number }>)
    : [];

  return {
    totalDocuments: docs.length,
    readyDocuments: docs.filter((d) => d.status === 'ready').length,
    totalChunks: docs.reduce((s, d) => s + (d.chunkCount ?? 0), 0),
    lastUpdated: new Date().toISOString(),
  };
}

async function fetchDocumentContent(documentId: string): Promise<string> {
  // 实际实现：从数据库获取文档的所有 chunks 拼接
  const response = await fetch(
    `http://localhost:3000/api/documents/${documentId}/content`,
  );

  if (!response.ok) {
    throw new McpError(ErrorCode.InvalidRequest, `文档不存在：${documentId}`);
  }

  return response.text();
}
// #endbook
