// #book-ref ch12-production-rag/server/src/routes/documents.ts
import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { db } from '../database/client.js';
import { documents } from '../database/schema.js';
import { NotFoundError, ValidationError } from '../errors.js';
import { computeContentHash } from '../lib/content-hash.js';
import { authMiddleware } from '../middleware/auth.js';
import { ingestionService } from '../services/ingestion-service.js';

type Env = { Variables: { userId: string } };

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'text/markdown',
  'text/x-markdown',
  'text/html',
  'text/plain',
];

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

const documentsRouter = new Hono<Env>()
  .use('*', authMiddleware)

  // 上传并处理文档
  .post('/upload', async (c) => {
    const userId = c.get('userId') as string;
    const formData = await c.req.formData();
    const file = formData.get('file') as File | null;

    if (!file) throw new ValidationError('请选择要上传的文件');
    if (file.size > MAX_FILE_SIZE)
      throw new ValidationError('文件不能超过 20MB');
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      throw new ValidationError(`不支持的文件类型：${file.type}`);
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // 1. 计算内容哈希，检查是否已上传过相同内容
    const contentHash = computeContentHash(buffer);
    const existing = await db.query.documents.findFirst({
      where: and(
        eq(documents.userId, userId),
        eq(documents.contentHash, contentHash),
      ),
      columns: { id: true, status: true, filename: true },
    });

    if (existing) {
      return c.json(
        {
          documentId: existing.id,
          message: `内容与已有文档「${existing.filename}」相同，跳过重复上传`,
          duplicate: true,
        },
        200,
      );
    }

    // 2. 创建文档记录（带 contentHash）
    const [document] = await db
      .insert(documents)
      .values({
        userId,
        filename: file.name,
        mimeType: file.type,
        fileSize: file.size,
        contentHash,
        status: 'pending',
      })
      .returning();

    // 在后台处理，不阻塞响应
    ingestionService
      .ingest(document?.id, buffer, file.name, file.type)
      .catch((err) => console.error(`文档 ${document?.id} 处理失败：`, err));

    return c.json(
      {
        documentId: document?.id,
        message: '文件已上传，正在后台处理',
      },
      202,
    );
  })

  // 查询文档列表
  .get('/', async (c) => {
    const userId = c.get('userId') as string;
    const docs = await db.query.documents.findMany({
      where: eq(documents.userId, userId),
      orderBy: (d, { desc }) => [desc(d.createdAt)],
      columns: {
        id: true,
        filename: true,
        mimeType: true,
        fileSize: true,
        status: true,
        chunkCount: true,
        errorMessage: true,
        createdAt: true,
      },
    });
    return c.json(docs);
  })

  // 查询单个文档状态（前端轮询用）
  .get('/:id/status', async (c) => {
    const userId = c.get('userId') as string;
    const { id } = c.req.param();

    const doc = await db.query.documents.findFirst({
      where: and(eq(documents.id, id), eq(documents.userId, userId)),
      columns: {
        id: true,
        status: true,
        chunkCount: true,
        errorMessage: true,
      },
    });

    if (!doc) throw new NotFoundError('Document', id);
    return c.json(doc);
  })

  // 删除文档（同时删除所有 chunks）
  .delete('/:id', async (c) => {
    const userId = c.get('userId') as string;
    const { id } = c.req.param();

    const doc = await db.query.documents.findFirst({
      where: and(eq(documents.id, id), eq(documents.userId, userId)),
    });

    if (!doc) throw new NotFoundError('Document', id);

    // 删除文档（chunks 会通过外键级联删除）
    await db.delete(documents).where(eq(documents.id, id));

    return c.json({ success: true });
  });

export default documentsRouter;
