// #book ch08-conversation-service
import { and, asc, desc, eq } from 'drizzle-orm';
// ch08-conversation/server/src/services/conversation-service.ts
import { db } from '../database/client.js';
import type { Message } from '../database/schema.js';
import { conversations, messages } from '../database/schema.js';
import { NotFoundError } from '../errors.js';

export class ConversationService {
  /**
   * 创建新会话
   */
  async create(
    userId: string,
    firstMessage?: string,
  ): Promise<typeof conversations.$inferSelect> {
    // 用第一条消息的前 20 字作为标题
    const title = firstMessage
      ? firstMessage.slice(0, 20) + (firstMessage.length > 20 ? '...' : '')
      : '新对话';

    const [conversation] = await db
      .insert(conversations)
      .values({ userId, title })
      .returning();

    return conversation!;
  }

  /**
   * 获取用户的所有会话（按更新时间倒序）
   */
  async listByUser(userId: string) {
    return db.query.conversations.findMany({
      where: eq(conversations.userId, userId),
      orderBy: desc(conversations.updatedAt),
      limit: 50,
    });
  }

  /**
   * 获取单个会话（含权限验证）
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
   * 获取会话的消息历史
   */
  async getMessages(conversationId: string): Promise<Message[]> {
    return db.query.messages.findMany({
      where: eq(messages.conversationId, conversationId),
      orderBy: asc(messages.createdAt),
    });
  }

  /**
   * 保存消息
   */
  async saveMessage(data: {
    conversationId: string;
    role: 'user' | 'assistant';
    content: string;
    inputTokens?: number | undefined;
    outputTokens?: number | undefined;
  }) {
    const [message] = await db.insert(messages).values(data).returning();

    // 更新会话的 updatedAt
    await db
      .update(conversations)
      .set({ updatedAt: new Date() })
      .where(eq(conversations.id, data.conversationId));

    return message!;
  }

  /**
   * 删除会话
   */
  async delete(conversationId: string, userId: string) {
    await this.getById(conversationId, userId); // 先验证权限
    await db.delete(conversations).where(eq(conversations.id, conversationId));
  }
}

export const conversationService = new ConversationService();
// #endbook
