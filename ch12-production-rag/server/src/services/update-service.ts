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

    if (!existing) throw new Error(`文档 ${documentId} 不存在`);

    // 哈希相同则跳过
    const newHash = computeContentHash(newBuffer);
    if (existing.contentHash === newHash) {
      return { updated: false, reason: '文档内容未变更，跳过更新' };
    }

    // 事务：先标记处理中，删除旧块，更新元数据
    await db.transaction(async (tx) => {
      await tx
        .update(documents)
        .set({ status: 'processing', updatedAt: new Date() })
        .where(eq(documents.id, documentId));

      // 删除旧向量块（原子性保证：不会出现新旧混用）
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

    // 事务外执行耗时的嵌入操作
    await ingestionService.ingest(documentId, newBuffer, filename, mimeType);
    await bm25Service.build(); // 重建 BM25 索引

    return {
      updated: true,
      reason: `文档已更新至第 ${(existing.version ?? 1) + 1} 版`,
    };
  }

  /**
   * 批量检测哪些文档需要更新
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
