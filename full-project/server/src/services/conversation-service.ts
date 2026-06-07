// #book-ref ch08-conversation/server/src/services/conversation-service.ts

import { and, asc, desc, eq } from 'drizzle-orm';
import { db } from '../database/client.js';
import type { Message } from '../database/schema.js';
import { conversations, messages } from '../database/schema.js';
import { NotFoundError } from '../errors.js';

export class ConversationService {
  /**
   * Create a new conversation
   */
  async create(
    userId: string,
    firstMessage?: string,
  ): Promise<typeof conversations.$inferSelect> {
    // Use the first 30 characters of the first message as the title
    const title = firstMessage
      ? firstMessage.slice(0, 30) + (firstMessage.length > 30 ? '...' : '')
      : 'New conversation';

    const [conversation] = await db
      .insert(conversations)
      .values({ userId, title })
      .returning();

    return conversation!;
  }

  /**
   * Get all conversations for a user (sorted by most recently updated)
   */
  async listByUser(userId: string) {
    return db.query.conversations.findMany({
      where: eq(conversations.userId, userId),
      orderBy: desc(conversations.updatedAt),
      limit: 50,
    });
  }

  /**
   * Get a single conversation with authorization check
   */
  async getById(conversationId: string, userId: string) {
    const conversation = await db.query.conversations.findFirst({
      where: and(
        eq(conversations.id, conversationId),
        eq(conversations.userId, userId),
      ),
    });

    if (!conversation) throw new NotFoundError('Conversation', conversationId);
    return conversation;
  }

  /**
   * Get message history for a conversation
   */
  async getMessages(conversationId: string): Promise<Message[]> {
    return db.query.messages.findMany({
      where: eq(messages.conversationId, conversationId),
      orderBy: asc(messages.createdAt),
    });
  }

  /**
   * Save a message
   */
  async saveMessage(data: {
    conversationId: string;
    role: 'user' | 'assistant';
    content: string;
    inputTokens?: number | undefined;
    outputTokens?: number | undefined;
  }) {
    const [message] = await db.insert(messages).values(data).returning();

    // Update the conversation's updatedAt timestamp
    await db
      .update(conversations)
      .set({ updatedAt: new Date() })
      .where(eq(conversations.id, data.conversationId));

    return message!;
  }

  /**
   * Delete a conversation
   */
  async delete(conversationId: string, userId: string) {
    await this.getById(conversationId, userId); // Authorization check first
    await db.delete(conversations).where(eq(conversations.id, conversationId));
  }
}

export const conversationService = new ConversationService();
