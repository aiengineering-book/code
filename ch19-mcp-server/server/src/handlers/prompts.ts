// #book ch19-prompts
// ch19-mcp-server/server/src/handlers/prompts.ts
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export function registerPromptHandlers(server: McpServer) {
  server.prompt(
    'knowledge_query',
    'Standard prompt for answering questions from the knowledge base',
    {
      question: z.string().describe('The question to answer'),
      format: z
        .enum(['detailed', 'brief'])
        .optional()
        .describe('Output format: detailed / brief'),
    },
    async ({ question, format = 'detailed' }) => {
      const formatInstruction =
        format === 'brief'
          ? 'Answer concisely in 2–3 sentences without citing sources.'
          : 'Answer in detail, annotating relevant content with [Source N], and list references at the end.';

      return {
        description: `Knowledge base query: ${question}`,
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `Please use the query_knowledge_base tool to search the knowledge base and answer the following question:\n\n${question}\n\n${formatInstruction}`,
            },
          },
        ],
      };
    },
  );

  server.prompt(
    'document_summary',
    'Prompt template for generating a document summary',
    {
      documentName: z.string().describe('Name of the document to summarize'),
    },
    async ({ documentName }) => {
      return {
        description: `Document summary: ${documentName}`,
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `Please use the get_document_list tool to find "${documentName}",\nthen use the query_knowledge_base tool to understand its main content,\nand generate a structured document summary including:\n1. Document overview (2–3 sentences)\n2. Main content (3–5 key points)\n3. Key information (important numbers, dates, conclusions, etc.)`,
            },
          },
        ],
      };
    },
  );

  server.prompt(
    'compare_documents',
    'Compare the content and differences between two documents',
    {
      doc1: z.string().describe('Name of the first document'),
      doc2: z.string().describe('Name of the second document'),
    },
    async ({ doc1, doc2 }) => {
      return {
        description: `Compare documents: ${doc1} vs ${doc2}`,
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `Please compare the content of the following two documents:\n- Document 1: ${doc1}\n- Document 2: ${doc2}\n\nAnalysis dimensions:\n1. Are the topics and purposes the same?\n2. What are the similarities and differences in key content?\n3. Which is more comprehensive / more recent / more accurate?\n4. Consolidated recommendation: in what scenarios should each be referenced?\n\nPlease use the query_knowledge_base tool to query each document separately.`,
            },
          },
        ],
      };
    },
  );
}
// #endbook
