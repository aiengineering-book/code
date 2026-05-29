// #book-ref ch11-rag/server/src/services/ingestion-service.ts
// #book-ref ch10-ingestion/server/src/services/ingestion-service.ts
import { eq } from 'drizzle-orm';
import { db } from '../database/client.js';
import { documents } from '../database/schema.js';
import { recursiveChunk } from '../lib/chunkers/recursive.js';
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
   * Process a single document (full pipeline)
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
      // 1. Update status to processing
      await db
        .update(documents)
        .set({ status: 'processing', updatedAt: new Date() })
        .where(eq(documents.id, documentId));

      // 2. Parse the document
      report({ stage: 'parsing', message: 'Parsing document...' });
      const parsed = await parseDocument(fileBuffer, filename, mimeType);

      if (!parsed.text.trim()) {
        throw new Error('Document is empty after parsing — possibly a scanned or encrypted file');
      }

      // 3. Update document metadata
      await db
        .update(documents)
        .set({ metadata: parsed.metadata, updatedAt: new Date() })
        .where(eq(documents.id, documentId));

      // 4. Chunk the text
      report({ stage: 'chunking', message: 'Splitting into chunks...' });
      const chunks = recursiveChunk(parsed.text, {
        chunkSize: 1000,
        overlap: 200,
      });

      if (chunks.length === 0) {
        throw new Error('Chunking produced no output');
      }

      report({
        stage: 'chunking',
        message: `Chunking complete: ${chunks.length} chunks`,
        progress: 25,
      });

      // 5. Generate embeddings
      report({
        stage: 'embedding',
        message: `Generating embeddings for ${chunks.length} chunks...`,
      });

      const chunkTexts = chunks.map((c) => c.content);
      const embeddings = await embedBatch(chunkTexts, (completed, total) => {
        report({
          stage: 'embedding',
          message: `Embedding progress: ${completed}/${total}`,
          progress: 25 + Math.floor((completed / total) * 50),
        });
      });

      // 6. Store to the database
      report({ stage: 'storing', message: 'Writing to database...' });

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

      // 7. Update document status to ready
      const totalTokens = embeddings.reduce((sum, e) => sum + e.tokens, 0);

      await db
        .update(documents)
        .set({
          status: 'ready',
          chunkCount: chunks.length,
          totalTokens: Math.ceil(totalTokens),
          updatedAt: new Date(),
        })
        .where(eq(documents.id, documentId));

      report({
        stage: 'done',
        message: `Complete: ${chunks.length} chunks, ${Math.ceil(totalTokens)} tokens`,
        progress: 100,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

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
   * Process multiple documents with concurrency control
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

    // Concurrency control: process up to `concurrency` documents at a time
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
          console.error(`[${task.documentId}] Processing failed:`, result.reason);
        }
      }
    }

    return { success, failed };
  }
}

export const ingestionService = new IngestionService();
