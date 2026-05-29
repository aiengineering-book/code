// #book ch19-resources
// ch19-mcp-server/server/src/handlers/resources.ts
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';

// Static resource definitions
const _STATIC_RESOURCES = [
  {
    uri: 'knowledge-base://documents/list',
    name: 'Knowledge base document index',
    description: 'List of all processed documents in the knowledge base',
    mimeType: 'application/json',
  },
  {
    uri: 'knowledge-base://stats',
    name: 'Knowledge base statistics',
    description: 'Document count, vector chunk count, last updated time, etc.',
    mimeType: 'application/json',
  },
];

export function registerResourceHandlers(server: McpServer) {
  // Static resource: knowledge base statistics
  server.resource(
    'knowledge-base-stats',
    'knowledge-base://stats',
    {
      description: 'Document count, vector chunk count, last updated time, etc.',
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

  // Static resource: document list
  server.resource(
    'knowledge-base-documents-list',
    'knowledge-base://documents/list',
    {
      description: 'List of all processed documents in the knowledge base',
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

  // Dynamic resource: individual document content (using URI template)
  server.resource(
    'knowledge-base-document',
    new ResourceTemplate('knowledge-base://document/{documentId}', {
      // list callback: return URIs for all ready documents
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
              description: `Document content: ${d.filename}`,
              mimeType: 'text/plain' as const,
            })),
        };
      },
    }),
    { description: 'Full content of a single document in the knowledge base', mimeType: 'text/plain' },
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
  // Implementation: fetch all chunks for the document from the database and concatenate
  const response = await fetch(
    `http://localhost:3000/api/documents/${documentId}/content`,
  );

  if (!response.ok) {
    throw new McpError(ErrorCode.InvalidRequest, `Document not found: ${documentId}`);
  }

  return response.text();
}
// #endbook
