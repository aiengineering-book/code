// #book-ref ch12-production-rag/server/src/services/ingestion-service.ts
import { eq } from 'drizzle-orm';
import { db } from '../database/client.js';
import { documents } from '../database/schema.js';
import { recursiveChunk } from '../lib/chunkers/recursive.js';
import { computeContentHash } from '../lib/content-hash.js';
import { embedBatch } from '../lib/embedding.js';
import { parseDocument } from '../lib/parsers/index.js';
import { storeChunks } from './vector-service.js';

export interface IngestionProgress {
  stage: 'parsing' | 'chunking' | 'embedding' | 'storing' | 'done' | 'error';
  message: string;
  progress?: number; // 0-100
}

export type ProgressCallback = (progress: IngestionProgress) => void;

export class IngestionService {
  /**
   * 处理单个文档（完整流水线）
   */
  async ingest(
    documentId: string,
    fileBuffer: Buffer,
    filename: string,
    mimeType: string,
    onProgress?: ProgressCallback,
  ): Promise<void> {
    const report = (progress: IngestionProgress) => {
      onProgress?.(progress);
      console.log(`[${documentId}] ${progress.stage}: ${progress.message}`);
    };

    try {
      // 1. 更新状态为处理中
      await db
        .update(documents)
        .set({ status: 'processing', updatedAt: new Date() })
        .where(eq(documents.id, documentId));

      // 2. 解析文档
      report({ stage: 'parsing', message: '正在解析文档...' });
      const parsed = await parseDocument(fileBuffer, filename, mimeType);

      if (!parsed.text.trim()) {
        throw new Error('文档解析后内容为空，可能是扫描件或加密文档');
      }

      // 3. 更新文档元数据
      await db
        .update(documents)
        .set({ metadata: parsed.metadata, updatedAt: new Date() })
        .where(eq(documents.id, documentId));

      // 4. 文本分块
      report({ stage: 'chunking', message: '正在分块...' });
      const chunks = recursiveChunk(parsed.text, {
        chunkSize: 1000,
        overlap: 200,
      });

      if (chunks.length === 0) {
        throw new Error('文本分块结果为空');
      }

      report({
        stage: 'chunking',
        message: `分块完成：共 ${chunks.length} 块`,
        progress: 25,
      });

      // 5. 批量生成嵌入向量
      report({
        stage: 'embedding',
        message: `正在生成嵌入向量（${chunks.length} 块）...`,
      });

      const chunkTexts = chunks.map((c) => c.content);
      const embeddings = await embedBatch(chunkTexts, (completed, total) => {
        report({
          stage: 'embedding',
          message: `嵌入进度：${completed}/${total}`,
          progress: 25 + Math.floor((completed / total) * 50),
        });
      });

      // 6. 存储到数据库
      report({ stage: 'storing', message: '正在写入数据库...' });

      const chunksToStore = chunks.map((chunk, i) => ({
        documentId,
        content: chunk.content,
        metadata: {
          ...parsed.metadata,
          chunkIndex: chunk.index,
          startChar: chunk.startChar,
          endChar: chunk.endChar,
        },
        chunkIndex: chunk.index,
        embedding: embeddings[i]?.embedding,
      }));

      await storeChunks(chunksToStore);

      // 7. 更新文档状态为完成
      const totalTokens = embeddings.reduce((sum, e) => sum + e.tokens, 0);

      await db
        .update(documents)
        .set({
          status: 'ready',
          chunkCount: chunks.length,
          totalTokens: Math.ceil(totalTokens),
          contentHash: computeContentHash(fileBuffer),
          updatedAt: new Date(),
        })
        .where(eq(documents.id, documentId));

      report({
        stage: 'done',
        message: `处理完成：${chunks.length} 个文本块，${Math.ceil(totalTokens)} Token`,
        progress: 100,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';

      await db
        .update(documents)
        .set({
          status: 'failed',
          errorMessage: message,
          updatedAt: new Date(),
        })
        .where(eq(documents.id, documentId));

      report({ stage: 'error', message });
      throw error;
    }
  }

  /**
   * 批量处理多个文档（并发控制）
   */
  async ingestBatch(
    tasks: Array<{
      documentId: string;
      fileBuffer: Buffer;
      filename: string;
      mimeType: string;
    }>,
    concurrency = 3,
    onProgress?: (documentId: string, progress: IngestionProgress) => void,
  ): Promise<{ success: string[]; failed: string[] }> {
    const success: string[] = [];
    const failed: string[] = [];

    // 并发控制：同时处理 concurrency 个文档
    for (let i = 0; i < tasks.length; i += concurrency) {
      const batch = tasks.slice(i, i + concurrency);

      const results = await Promise.allSettled(
        batch.map((task) =>
          this.ingest(
            task.documentId,
            task.fileBuffer,
            task.filename,
            task.mimeType,
            (progress) => onProgress?.(task.documentId, progress),
          ),
        ),
      );

      for (let j = 0; j < results.length; j++) {
        const result = results[j]!;
        const task = batch[j]!;
        if (result.status === 'fulfilled') {
          success.push(task.documentId);
        } else {
          failed.push(task.documentId);
          console.error(`[${task.documentId}] 处理失败：`, result.reason);
        }
      }
    }

    return { success, failed };
  }
}

export const ingestionService = new IngestionService();
