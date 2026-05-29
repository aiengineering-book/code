// #book ch04-todos-routes
// ch04-fullstack-basics/server/src/routes/todos.ts

import { zValidator } from '@hono/zod-validator';
import { and, desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../database/client.js';
import { todos } from '../database/schema.js';
import { NotFoundError } from '../errors.js';
import { authMiddleware } from '../middleware/auth.js';

const CreateTodoSchema = z.object({
  title: z.string().min(1).max(500),
});

const UpdateTodoSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  completed: z.boolean().optional(),
});

type Env = { Variables: { userId: string; userEmail: string } };

const todoRouter = new Hono<Env>()
  .use('*', authMiddleware) // All todo routes require authentication
  .get('/', async (c) => {
    const userId = c.get('userId') as string;
    const { completed } = c.req.query();

    const items = await db.query.todos.findMany({
      where: (t, { eq, and }) => {
        const conditions = [eq(t.userId, userId)];
        if (completed !== undefined) {
          conditions.push(eq(t.completed, completed === 'true'));
        }
        return and(...conditions);
      },
      orderBy: (t) => [desc(t.createdAt)],
    });

    return c.json(items);
  })
  .post('/', zValidator('json', CreateTodoSchema), async (c) => {
    const userId = c.get('userId') as string;
    const { title } = c.req.valid('json');

    const [todo] = await db.insert(todos).values({ userId, title }).returning();

    return c.json(todo!, 201);
  })
  .patch('/:id', zValidator('json', UpdateTodoSchema), async (c) => {
    const userId = c.get('userId') as string;
    const { id } = c.req.param();
    const updates = c.req.valid('json');

    // Verify the todo belongs to the current user (prevents modifying others' data)
    const existing = await db.query.todos.findFirst({
      where: and(eq(todos.id, id), eq(todos.userId, userId)),
    });

    if (!existing) throw new NotFoundError('Todo', id);

    // Filter out undefined values to avoid exactOptionalPropertyTypes errors
    const setValues: Record<string, unknown> = { updatedAt: new Date() };
    if (updates.title !== undefined) setValues.title = updates.title;
    if (updates.completed !== undefined)
      setValues.completed = updates.completed;

    const [updated] = await db
      .update(todos)
      .set(setValues)
      .where(eq(todos.id, id))
      .returning();

    return c.json(updated!);
  })
  .delete('/:id', async (c) => {
    const userId = c.get('userId') as string;
    const { id } = c.req.param();

    const existing = await db.query.todos.findFirst({
      where: and(eq(todos.id, id), eq(todos.userId, userId)),
    });

    if (!existing) throw new NotFoundError('Todo', id);

    await db.delete(todos).where(eq(todos.id, id));

    return c.json({ success: true });
  });

export default todoRouter;
// #endbook
