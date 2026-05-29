// #book ch19-tools
// ch19-mcp-server/server/src/handlers/tools.ts

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

export function registerToolHandlers(server: McpServer) {
  // The SDK automatically serializes the handler's return value into a JSON-RPC response frame,
  // written back to stdout (stdio transport) or pushed to the SSE stream (Streamable HTTP).
  // You only need to return data — no manual res.json(), res.write(), or console.log needed.

  server.tool(
    'query_knowledge_base',
    'Search the knowledge base for relevant content and return the most relevant document chunks with source citations. Best for answering questions based on internal documents.',
    {
      question: z.string().describe('The question to query'),
      limit: z.number().optional().describe('Maximum number of results to return, default 5'),
    },
    async ({ question, limit = 5 }) => {
      try {
        return await handleQueryKnowledgeBase({ question, limit });
      } catch (error) {
        if (error instanceof McpError) throw error;
        // Tool execution error: return error content (don't throw McpError)
        // Let the LLM see the error message and decide the next step
        return {
          content: [
            {
              type: 'text' as const,
              text: `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'search_code',
    'Search the codebase for a specific function, class, or pattern',
    {
      pattern: z.string().describe('The code pattern or keyword to search for'),
      fileExtension: z
        .string()
        .optional()
        .describe('Restrict search to this file type, e.g. ".ts" ".py" (optional)'),
    },
    async ({ pattern, fileExtension }) => {
      try {
        return await handleSearchCode({ pattern, fileExtension });
      } catch (error) {
        if (error instanceof McpError) throw error;
        return {
          content: [
            {
              type: 'text' as const,
              text: `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'get_document_list',
    'Get a list of all documents in the knowledge base, including name, size, and processing status',
    {
      status: z
        .enum(['ready', 'processing', 'failed'])
        .optional()
        .describe('Filter by status: ready / processing / failed (optional)'),
    },
    async ({ status }) => {
      try {
        return await handleGetDocumentList({ status });
      } catch (error) {
        if (error instanceof McpError) throw error;
        return {
          content: [
            {
              type: 'text' as const,
              text: `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}

// Tool implementations
async function handleQueryKnowledgeBase(args: {
  question: string;
  limit?: number;
}) {
  const { question, limit = 5 } = args;

  // Call the RAG service (via HTTP or direct call in a real project)
  const response = await fetch(`http://localhost:3000/api/rag/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, limit }),
  });

  if (!response.ok) {
    throw new Error(`RAG service request failed: ${response.status}`);
  }

  const result = (await response.json()) as {
    answer: string;
    citations: Array<{ documentName: string; content: string; score: number }>;
  };

  // Format the output for easy LLM reading
  const citationsText = result.citations
    .map((c, i) => `[Source ${i + 1}] ${c.documentName}\n${c.content}`)
    .join('\n\n---\n\n');

  return {
    content: [
      {
        type: 'text' as const,
        text: [
          `Query result: ${question}`,
          '',
          `Answer: ${result.answer}`,
          '',
          `References (${result.citations.length}):`,
          citationsText,
        ].join('\n'),
      },
    ],
  };
}

async function handleSearchCode(args: {
  pattern: string;
  fileExtension?: string | undefined;
}) {
  const { pattern, fileExtension } = args;

  // Implementation: call the file search tool (provided by packages/server in the monorepo)
  let searchResult: string | null = null;
  try {
    // @ts-expect-error — path exists in the full monorepo; standalone build falls through to catch
    const mod = await import(
      '../../packages/server/src/lib/agent/tools/file-tools.js'
    );
    searchResult = await mod.searchInFilesTool.execute({
      pattern,
      filePattern: fileExtension,
    });
  } catch {
    return {
      content: [
        {
          type: 'text' as const,
          text: 'Code search service not available',
        },
      ],
    };
  }

  return {
    content: [{ type: 'text' as const, text: searchResult ?? '' }],
  };
}

async function handleGetDocumentList(args: {
  status?: 'ready' | 'processing' | 'failed' | undefined;
}) {
  const { status } = args;

  const url = new URL('http://localhost:3000/api/documents');
  if (status) url.searchParams.set('status', status);

  const response = await fetch(url.toString());
  const docs = (await response.json()) as Array<{
    id: string;
    filename: string;
    status: string;
    chunkCount: number;
    fileSize: number;
  }>;

  const table = docs
    .map(
      (d) =>
        `- ${d.filename} (${d.status}, ${d.chunkCount ?? 0} chunks, ${(d.fileSize / 1024).toFixed(1)}KB)`,
    )
    .join('\n');

  return {
    content: [
      {
        type: 'text' as const,
        text: `Knowledge base documents (${docs.length} total):\n${table}`,
      },
    ],
  };
}
// #endbook
