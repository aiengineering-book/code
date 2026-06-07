// #book ch04-auth-routes
// ch04-fullstack-basics/server/src/routes/auth.ts

import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../database/client.js';
import { users } from '../database/schema.js';
import {
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../errors.js';
import { signToken } from '../utils/jwt.js';
import { hashPassword, verifyPassword } from '../utils/password.js';

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1).max(50),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

type Env = { Variables: { userId: string; userEmail: string } };

const auth = new Hono<Env>()
  .post('/register', zValidator('json', RegisterSchema), async (c) => {
    const { email, password, name } = c.req.valid('json');

    // Check if email is already registered
    const existing = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (existing) {
      throw new ValidationError('This email address is already registered');
    }

    const passwordHash = await hashPassword(password);

    const [user] = await db
      .insert(users)
      .values({ email, passwordHash, name })
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        createdAt: users.createdAt,
      });

    if (!user) throw new ValidationError('Failed to create user');

    const token = signToken({ userId: user.id, email: user.email });

    return c.json({ user, token }, 201);
  })
  .post('/login', zValidator('json', LoginSchema), async (c) => {
    const { email, password } = c.req.valid('json');

    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!user) {
      // Don't reveal whether the email exists — return the same error either way
      throw new UnauthorizedError('Invalid email or password');
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const token = signToken({ userId: user.id, email: user.email });

    return c.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
      },
      token,
    });
  })
  .get('/me', async (c) => {
    // Auth middleware guarantees userId is present here
    const userId = c.get('userId') as string;

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { passwordHash: false }, // Never return the password hash
    });

    if (!user) throw new NotFoundError('User', userId);

    return c.json(user);
  });

export default auth;
// #endbook
