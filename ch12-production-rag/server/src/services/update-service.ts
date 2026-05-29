// #book ch12-update-service
// ch12-production-rag/server/src/services/update-service.ts

import { eq } from 'drizzle-orm';
import { db } from '../database/client.js';
import { documentChunks, documents } from '../database/schema.js';
import { computeContentHash } from '../lib/content-hash.js';
import { bm25Service } from './bm25-service.js';
import { ingestionService } from './ingestion-service.js';

export class DocumentUpdateService {
  async update(
    documentId: string,
    newBuffer: Buffer,
    filename: string,
    mimeType: string,
  ): Promise<{ updated: boolean; reason: string }> {
    const existing = await db.query.documents.findFirst({
      where: eq(documents.id, documentId),
    });

    if (!existing) throw new Error(`Document ${documentId} not found`);

    // Skip if content is unchanged
    const newHash = computeContentHash(newBuffer);
    if (existing.contentHash === newHash) {
      return { updated: false, reason: 'Content unchanged — skipping update' };
    }

    // Transaction: mark as processing, delete old chunks, update metadata
    await db.transaction(async (tx) => {
      await tx
        .update(documents)
        .set({ status: 'processing', updatedAt: new Date() })
        .where(eq(documents.id, documentId));

      // Delete old vector chunks (atomic: no old/new mix-up)
      await tx
        .delete(documentChunks)
        .where(eq(documentChunks.documentId, documentId));

      await tx
        .update(documents)
        .set({
          filename,
          mimeType,
          fileSize: newBuffer.length,
          contentHash: newHash,
          version: (existing.version ?? 1) + 1,
          status: 'pending',
          errorMessage: null,
          updatedAt: new Date(),
        })
        .where(eq(documents.id, documentId));
    });

    // Time-consuming embedding runs outside the transaction
    await ingestionService.ingest(documentId, newBuffer, filename, mimeType);
    await bm25Service.build(); // Rebuild BM25 index

    return {
      updated: true,
      reason: `Document updated to version ${(existing.version ?? 1) + 1}`,
    };
  }

  /**
   * Check which documents in a batch need updating
   */
  async checkBatch(
    items: Array<{ documentId: string; buffer: Buffer }>,
  ): Promise<Array<{ documentId: string; needsUpdate: boolean }>> {
    const ids = items.map((i) => i.documentId);
    const existing = await db.query.documents.findMany({
      where: (d, { inArray }) => inArray(d.id, ids),
      columns: { id: true, contentHash: true },
    });
    const hashMap = new Map(existing.map((d) => [d.id, d.contentHash]));

    return items.map((item) => ({
      documentId: item.documentId,
      needsUpdate:
        hashMap.get(item.documentId) !== computeContentHash(item.buffer),
    }));
  }
}

export const documentUpdateService = new DocumentUpdateService();
// #endbook
