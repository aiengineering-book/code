// #book-ref ch04-auth-routes

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
  password: z.string().min(8, '密码至少 8 位'),
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

    // 检查邮箱是否已注册
    const existing = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (existing) {
      throw new ValidationError('该邮箱已被注册');
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

    const token = signToken({ userId: user?.id, email: user?.email });

    return c.json({ user, token }, 201);
  })
  .post('/login', zValidator('json', LoginSchema), async (c) => {
    const { email, password } = c.req.valid('json');

    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!user) {
      // 不要透露"用户不存在"，统一返回相同错误
      throw new UnauthorizedError('邮箱或密码错误');
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedError('邮箱或密码错误');
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
    // 这个路由需要认证，由外层中间件保证 userId 存在
    const userId = c.get('userId') as string;

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { passwordHash: false }, // 不返回密码哈希
    });

    if (!user) throw new NotFoundError('User', userId);

    return c.json(user);
  });

export default auth;
// #endbook-ref
