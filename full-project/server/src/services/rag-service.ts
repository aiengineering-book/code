// #book-ref ch12-production-rag/server/src/services/rag-service.ts
// #book-ref ch11-rag/server/src/services/rag-service.ts
import { db } from '../database/client.js';
import { callLLM } from '../lib/llm.js';
import { DEFAULT_MODEL, openai } from '../lib/openai.js';
import { type RetrievalResult, retrieve } from './retrieval-service.js';

export interface Citation {
  documentId: string;
  documentName: string;
  content: string;
  chunkIndex: number;
  score: number;
}

export interface RAGResponse {
  answer: string;
  citations: Citation[];
  retrievedCount: number;
}

const RAG_SYSTEM_PROMPT = `
You are a professional knowledge base Q&A assistant.

Answer rules:
1. Answer only based on the provided reference materials — do not supplement with training knowledge
2. If the reference materials don't contain sufficient information, say clearly "The reference materials do not contain relevant information"
3. After relevant statements, annotate the source with [Source N] (N is the reference number)
4. Keep answers concise and accurate — answer directly
`.trim();

export class RAGService {
  private async buildContext(
    retrieved: RetrievalResult[],
    _question: string,
  ): Promise<{
    context: string;
    citations: Citation[];
    docNameMap: Map<string, string>;
  }> {
    const documentIds = [...new Set(retrieved.map((r) => r.documentId))];
    const documentRecords = await db.query.documents.findMany({
      where: (d, { inArray }) => inArray(d.id, documentIds),
      columns: { id: true, filename: true },
    });
    const docNameMap = new Map(documentRecords.map((d) => [d.id, d.filename]));

    const context = retrieved
      .map(
        (r, i) =>
          `[Source ${i + 1}] ${docNameMap.get(r.documentId) ?? 'Unknown document'}\n${r.content}`,
      )
      .join('\n\n---\n\n');

    const citations: Citation[] = retrieved.map((r) => ({
      documentId: r.documentId,
      documentName: docNameMap.get(r.documentId) ?? 'Unknown document',
      content: r.content.slice(0, 200) + (r.content.length > 200 ? '...' : ''),
      chunkIndex: (r.metadata?.chunkIndex as number) ?? 0,
      score: r.rerankScore ?? r.score,
    }));

    return { context, citations, docNameMap };
  }

  /**
   * Non-streaming Q&A
   */
  async query(
    question: string,
    options: {
      documentId?: string | undefined;
      limit?: number | undefined;
      useRerank?: boolean | undefined;
    } = {},
  ): Promise<RAGResponse> {
    const { limit = 5, documentId, useRerank = true } = options;

    const retrieved = await retrieve(question, {
      limit,
      minScore: 0.3,
      documentId,
      useRerank,
    });

    if (retrieved.length === 0) {
      return {
        answer:
          'Sorry, no relevant content was found in the knowledge base for your question. Try rephrasing, or upload a relevant document.',
        citations: [],
        retrievedCount: 0,
      };
    }

    const { context, citations } = await this.buildContext(retrieved, question);

    const { text: answer } = await callLLM(
      [
        {
          role: 'user',
          content: `Reference materials:\n\n${context}\n\n---\n\nQuestion: ${question}`,
        },
      ],
      { system: RAG_SYSTEM_PROMPT, temperature: 0.3, maxTokens: 2048 },
    );

    return { answer, citations, retrievedCount: retrieved.length };
  }

  /**
   * Streaming Q&A: citations first, then streamed answer
   */
  async *queryStream(
    question: string,
    options: Parameters<RAGService['query']>[1] = {},
  ): AsyncGenerator<
    | { type: 'citations'; citations: Citation[] }
    | { type: 'delta'; text: string }
    | { type: 'done' }
  > {
    const { limit = 5, documentId, useRerank = true } = options;

    const retrieved = await retrieve(question, {
      limit,
      minScore: 0.3,
      documentId,
      useRerank,
    });

    if (retrieved.length === 0) {
      yield { type: 'delta', text: 'Sorry, no relevant content was found in the knowledge base.' };
      yield { type: 'done' };
      return;
    }

    const { context, citations } = await this.buildContext(retrieved, question);

    // Send citations first — frontend can immediately show "Reviewing X documents..."
    yield { type: 'citations', citations };

    // Stream the answer
    const stream = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      max_completion_tokens: 2048,
      temperature: 0.3,
      messages: [
        { role: 'system', content: RAG_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Reference materials:\n\n${context}\n\n---\n\nQuestion: ${question}`,
        },
      ],
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        yield { type: 'delta', text: delta };
      }
    }

    yield { type: 'done' };
  }
}

export const ragService = new RAGService();
