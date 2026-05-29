// #book-ref ch12-production-rag/server/src/services/rag-service.ts
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
你是一个专业的知识库问答助手。

回答规则：
1. 只基于提供的参考资料回答，不要使用训练知识补充内容
2. 如果参考资料中没有足够的信息，明确说"参考资料中未找到相关信息"
3. 回答时在相关内容后用 [来源N] 标注引用（N 是参考资料的编号）
4. 回答简洁、准确，直接回答问题
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
          `[来源${i + 1}] ${docNameMap.get(r.documentId) ?? '未知文档'}\n${r.content}`,
      )
      .join('\n\n---\n\n');

    const citations: Citation[] = retrieved.map((r) => ({
      documentId: r.documentId,
      documentName: docNameMap.get(r.documentId) ?? '未知文档',
      content: r.content.slice(0, 200) + (r.content.length > 200 ? '...' : ''),
      chunkIndex: (r.metadata?.chunkIndex as number) ?? 0,
      score: r.rerankScore ?? r.score,
    }));

    return { context, citations, docNameMap };
  }

  /**
   * 非流式问答
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
          '抱歉，知识库中没有找到与您问题相关的内容。请尝试换一种方式提问，或上传相关文档。',
        citations: [],
        retrievedCount: 0,
      };
    }

    const { context, citations } = await this.buildContext(retrieved, question);

    const { text: answer } = await callLLM(
      [
        {
          role: 'user',
          content: `参考资料：\n\n${context}\n\n---\n\n问题：${question}`,
        },
      ],
      { system: RAG_SYSTEM_PROMPT, temperature: 0.3, maxTokens: 2048 },
    );

    return { answer, citations, retrievedCount: retrieved.length };
  }

  /**
   * 流式问答：先发引用，再流式生成答案
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
      yield { type: 'delta', text: '抱歉，知识库中未找到相关内容。' };
      yield { type: 'done' };
      return;
    }

    const { context, citations } = await this.buildContext(retrieved, question);

    // 先发引用，前端可以立即展示"正在查阅 X 份文档"
    yield { type: 'citations', citations };

    // 流式生成答案
    const stream = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      max_completion_tokens: 2048,
      temperature: 0.3,
      messages: [
        { role: 'system', content: RAG_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `参考资料：\n\n${context}\n\n---\n\n问题：${question}`,
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
