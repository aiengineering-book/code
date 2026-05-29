// #book ch19-tools

// ch19-mcp-server/server/src/handlers/tools.ts
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

export function registerToolHandlers(server: McpServer) {
  // SDK 会把处理器的返回值自动序列化为 JSON-RPC 响应帧，写回 stdout（stdio 传输）
  // 或推送到 SSE 流（Streamable HTTP 传输）。你只需要 return 数据，不需要手动调用
  // res.json()、res.write() 之类的接口，也不需要 console.log。

  server.tool(
    'query_knowledge_base',
    '在知识库中搜索相关内容，返回最相关的文档片段和来源引用。适合回答基于内部文档的问题。',
    {
      question: z.string().describe('要查询的问题'),
      limit: z.number().optional().describe('返回的最大结果数，默认 5'),
    },
    async ({ question, limit = 5 }) => {
      try {
        return await handleQueryKnowledgeBase({ question, limit });
      } catch (error) {
        if (error instanceof McpError) throw error;
        // 工具执行错误：返回错误内容（不抛出 MCP 错误）
        // 让 LLM 看到错误信息，自行决定下一步
        return {
          content: [
            {
              type: 'text' as const,
              text: `工具执行失败：${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'search_code',
    '在代码库中搜索特定的函数、类或模式',
    {
      pattern: z.string().describe('要搜索的代码模式或关键词'),
      fileExtension: z
        .string()
        .optional()
        .describe('限制搜索的文件类型，如 ".ts" ".py"（可选）'),
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
              text: `工具执行失败：${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'get_document_list',
    '获取知识库中所有文档的列表，包括文档名称、大小和处理状态',
    {
      status: z
        .enum(['ready', 'processing', 'failed'])
        .optional()
        .describe('按状态过滤：ready / processing / failed（可选）'),
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
              text: `工具执行失败：${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}

// 工具实现
async function handleQueryKnowledgeBase(args: {
  question: string;
  limit?: number;
}) {
  const { question, limit = 5 } = args;

  // 调用 RAG 服务（实际项目中通过 HTTP 或直接调用）
  const response = await fetch(`http://localhost:3000/api/rag/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, limit }),
  });

  if (!response.ok) {
    throw new Error(`RAG 服务请求失败：${response.status}`);
  }

  const result = (await response.json()) as {
    answer: string;
    citations: Array<{ documentName: string; content: string; score: number }>;
  };

  // 格式化输出，方便 LLM 阅读
  const citationsText = result.citations
    .map((c, i) => `[来源${i + 1}] ${c.documentName}\n${c.content}`)
    .join('\n\n---\n\n');

  return {
    content: [
      {
        type: 'text' as const,
        text: [
          `查询结果：${question}`,
          '',
          `回答：${result.answer}`,
          '',
          `参考来源（${result.citations.length} 条）：`,
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

  // 实际实现：调用文件搜索（Monorepo 中 packages/server 提供 file-tools）
  let searchResult: string | null = null;
  try {
    // @ts-expect-error — 路径在完整 Monorepo 中存在，独立构建时走 catch
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
          text: '代码搜索服务未启用',
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
        `- ${d.filename} (${d.status}, ${d.chunkCount ?? 0} 块, ${(d.fileSize / 1024).toFixed(1)}KB)`,
    )
    .join('\n');

  return {
    content: [
      {
        type: 'text' as const,
        text: `知识库文档列表（共 ${docs.length} 个）：\n${table}`,
      },
    ],
  };
}
// #endbook
