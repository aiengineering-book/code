// #book ch10-documents-route
// ch10-ingestion/server/src/routes/documents.ts

import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { db } from '../database/client.js';
import { documents } from '../database/schema.js';
import { NotFoundError, ValidationError } from '../errors.js';
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

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

const documentsRouter = new Hono<Env>()
  .use('*', authMiddleware)

  // Upload and process a document
  .post('/upload', async (c) => {
    const userId = c.get('userId') as string;
    const formData = await c.req.formData();
    const file = formData.get('file') as File | null;

    if (!file) throw new ValidationError('Please select a file to upload');
    if (file.size > MAX_FILE_SIZE)
      throw new ValidationError('File size must not exceed 20 MB');
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      throw new ValidationError(`Unsupported file type: ${file.type}`);
    }

    // 1. Create the document record
    const [document] = await db
      .insert(documents)
      .values({
        userId,
        filename: file.name,
        mimeType: file.type,
        fileSize: file.size,
        status: 'pending',
      })
      .returning();

    // 2. Process asynchronously — don't await, respond immediately
    const buffer = Buffer.from(await file.arrayBuffer());

    // Process in the background without blocking the response
    ingestionService
      .ingest(document?.id, buffer, file.name, file.type)
      .catch((err) => console.error(`Document ${document?.id} processing failed:`, err));

    return c.json(
      {
        documentId: document?.id,
        message: 'File uploaded — processing in the background',
      },
      202,
    );
  })

  // List all documents for the current user
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

  // Query a single document's processing status (for polling)
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

  // Delete a document (chunks cascade-delete)
  .delete('/:id', async (c) => {
    const userId = c.get('userId') as string;
    const { id } = c.req.param();

    const doc = await db.query.documents.findFirst({
      where: and(eq(documents.id, id), eq(documents.userId, userId)),
    });

    if (!doc) throw new NotFoundError('Document', id);

    // Delete document (chunks are cascade-deleted via foreign key)
    await db.delete(documents).where(eq(documents.id, id));

    return c.json({ success: true });
  });

export default documentsRouter;
// #endbook
