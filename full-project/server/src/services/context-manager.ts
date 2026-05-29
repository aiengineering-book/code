// #book-ref ch08-context-manager

import { eq } from 'drizzle-orm';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions.js';
import { db } from '../database/client.js';
import type { Message } from '../database/schema.js';
import { conversations } from '../database/schema.js';
import { DEFAULT_MODEL, openai } from '../lib/openai.js';

// 保留最近几轮不压缩（保证近期对话的完整性）
const RECENT_TURNS_TO_KEEP = 6;
// 估算 Token 数超过这个值时触发压缩
const COMPRESSION_THRESHOLD_TOKENS = 60_000;

/**
 * 估算消息列表的 Token 数（粗略估算）
 */
function estimateTokenCount(messages: ChatCompletionMessageParam[]): number {
  const totalChars = messages.reduce((sum, m) => {
    const content = typeof m.content === 'string' ? m.content : '';
    return sum + content.length;
  }, 0);
  // 中英文混合，粗略按 2 字符 = 1 Token 估算
  return Math.ceil(totalChars / 2);
}

/**
 * 将数据库消息转换为 OpenAI API 格式
 */
export function messagesToParams(
  dbMessages: Message[],
): ChatCompletionMessageParam[] {
  return dbMessages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));
}

/**
 * 生成对话摘要
 */
async function summarizeMessages(
  messagesToSummarize: ChatCompletionMessageParam[],
): Promise<string> {
  const conversationText = messagesToSummarize
    .map(
      (m) =>
        `${m.role === 'user' ? '用户' : '助手'}：${
          typeof m.content === 'string' ? m.content : '[复杂内容]'
        }`,
    )
    .join('\n\n');

  const response = await openai.chat.completions.create({
    model: DEFAULT_MODEL,
    max_completion_tokens: 1024,
    temperature: 0,
    messages: [
      {
        role: 'user',
        content: `请对以下对话内容生成一个简洁的摘要，保留所有重要信息、用户的核心需求和已解决/未解决的问题。摘要用第三人称描述，300字以内。

对话内容：
${conversationText}`,
      },
    ],
  });

  return response.choices[0]?.message.content ?? '';
}

/**
 * 获取处理过的消息列表（自动处理上下文超限）
 */
export async function getManagedContext(
  conversationId: string,
  dbMessages: Message[],
  existingSummary?: string | null,
): Promise<{
  messages: ChatCompletionMessageParam[];
  summary: string | null;
  compressed: boolean;
}> {
  const allParams = messagesToParams(dbMessages);
  const estimatedTokens = estimateTokenCount(allParams);

  // Token 数未超限，直接返回全部历史
  if (estimatedTokens < COMPRESSION_THRESHOLD_TOKENS) {
    return {
      messages: allParams,
      summary: existingSummary ?? null,
      compressed: false,
    };
  }

  // 超限：保留最近 N 轮，压缩早期消息
  const recentMessages = allParams.slice(-RECENT_TURNS_TO_KEEP * 2);
  const olderMessages = allParams.slice(0, -RECENT_TURNS_TO_KEEP * 2);

  if (olderMessages.length === 0) {
    // 如果连最近几轮都超限了，只能截断
    return {
      messages: recentMessages,
      summary: existingSummary ?? null,
      compressed: true,
    };
  }

  // 生成摘要（如果已有摘要，将其与新的早期消息合并再摘要）
  const messagesToSummarizeList = existingSummary
    ? [
        { role: 'user' as const, content: `[之前对话摘要] ${existingSummary}` },
        ...olderMessages,
      ]
    : olderMessages;

  const newSummary = await summarizeMessages(messagesToSummarizeList);

  // 将摘要作为系统背景注入
  const contextWithSummary: ChatCompletionMessageParam[] = [
    {
      role: 'user',
      content: `[对话背景摘要]\n${newSummary}\n\n以下是最近的对话记录：`,
    },
    { role: 'assistant', content: '好的，我已了解之前的对话背景，请继续。' },
    ...recentMessages,
  ];

  // 持久化摘要到数据库
  await db
    .update(conversations)
    .set({ summary: newSummary })
    .where(eq(conversations.id, conversationId));

  return {
    messages: contextWithSummary,
    summary: newSummary,
    compressed: true,
  };
}
// #endbook-ref
