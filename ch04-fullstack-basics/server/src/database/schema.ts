// #book ch04-drizzle-schema
// ch04-fullstack-basics/server/src/database/schema.ts
import {
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
    // References the users table; deleting a user cascades to their todos
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    completed: boolean('completed').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    // Index on userId — speeds up "get all todos for a user"
    userIdIdx: index('todos_user_id_idx').on(table.userId),
  }),
);

// TypeScript types inferred from the schema — no manual interface maintenance
export type User = typeof users.$inferSelect;    // Type of query results
export type NewUser = typeof users.$inferInsert; // Type for inserts
export type Todo = typeof todos.$inferSelect;
export type NewTodo = typeof todos.$inferInsert;
// #endbook
