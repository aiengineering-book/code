// #book ch19-prompts
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
// ch19-mcp-server/server/src/handlers/prompts.ts
import { z } from 'zod';

export function registerPromptHandlers(server: McpServer) {
  server.prompt(
    'knowledge_query',
    '基于知识库回答问题的标准提示',
    {
      question: z.string().describe('要回答的问题'),
      format: z
        .enum(['detailed', 'brief'])
        .optional()
        .describe('输出格式：detailed（详细）/ brief（简洁）'),
    },
    async ({ question, format = 'detailed' }) => {
      const formatInstruction =
        format === 'brief'
          ? '用 2-3 句话简洁回答，不需要引用来源。'
          : '详细回答，在相关内容后标注 [来源N]，最后列出参考文档。';

      return {
        description: `知识库查询：${question}`,
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `请使用 query_knowledge_base 工具查询知识库，回答以下问题：\n\n${question}\n\n${formatInstruction}`,
            },
          },
        ],
      };
    },
  );

  server.prompt(
    'document_summary',
    '生成文档摘要的提示模板',
    {
      documentName: z.string().describe('要摘要的文档名称'),
    },
    async ({ documentName }) => {
      return {
        description: `文档摘要：${documentName}`,
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `请使用 get_document_list 工具找到"${documentName}"，\n然后使用 query_knowledge_base 工具了解其主要内容，\n生成一份结构化的文档摘要，包括：\n1. 文档概述（2-3 句话）\n2. 主要内容（3-5 个要点）\n3. 关键信息（重要数字、日期、结论等）`,
            },
          },
        ],
      };
    },
  );

  server.prompt(
    'compare_documents',
    '对比两份文档的内容和差异',
    {
      doc1: z.string().describe('第一份文档的名称'),
      doc2: z.string().describe('第二份文档的名称'),
    },
    async ({ doc1, doc2 }) => {
      return {
        description: `对比文档：${doc1} vs ${doc2}`,
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `请对比以下两份文档的内容：\n- 文档一：${doc1}\n- 文档二：${doc2}\n\n分析维度：\n1. 主题和目的是否相同？\n2. 关键内容有哪些异同？\n3. 哪份更全面/更新/更准确？\n4. 综合建议：在什么场景下应该参考哪份？\n\n请使用 query_knowledge_base 工具分别查询两份文档的内容。`,
            },
          },
        ],
      };
    },
  );
}
// #endbook
