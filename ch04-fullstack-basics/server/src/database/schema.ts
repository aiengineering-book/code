// #book ch04-drizzle-schema
import {
// ch04-fullstack-basics/server/src/database/schema.ts
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const todos = pgTable(
  'todos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // 关联到 users 表，用户删除时自动删除其待办（onDelete: 'cascade'）
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    completed: boolean('completed').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    // 为 userId 建索引，加速"查询某用户的所有待办"
    userIdIdx: index('todos_user_id_idx').on(table.userId),
  }),
);

// TypeScript 类型从 Schema 自动推断——不需要手写 interface
export type User = typeof users.$inferSelect; // 查询结果的类型
export type NewUser = typeof users.$inferInsert; // 插入数据的类型
export type Todo = typeof todos.$inferSelect;
export type NewTodo = typeof todos.$inferInsert;
// #endbook
