// #book ch08-context-manager
// ch08-conversation/server/src/services/context-manager.ts

import { eq } from 'drizzle-orm';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions.js';
import { db } from '../database/client.js';
import type { Message } from '../database/schema.js';
import { conversations } from '../database/schema.js';
import { DEFAULT_MODEL, openai } from '../lib/openai.js';

// Keep this many recent turns uncompressed
const RECENT_TURNS_TO_KEEP = 6;
// Trigger compression when estimated token count exceeds this
const COMPRESSION_THRESHOLD_TOKENS = 60_000;

/**
 * Rough token count estimate for a message list
 */
function estimateTokenCount(messages: ChatCompletionMessageParam[]): number {
  const totalChars = messages.reduce((sum, m) => {
    const content = typeof m.content === 'string' ? m.content : '';
    return sum + content.length;
  }, 0);
  // Rough estimate: 2 characters per token for mixed-language text
  return Math.ceil(totalChars / 2);
}

/**
 * Convert database messages to OpenAI API format
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
 * Summarize a list of messages
 */
async function summarizeMessages(
  messagesToSummarize: ChatCompletionMessageParam[],
): Promise<string> {
  const conversationText = messagesToSummarize
    .map(
      (m) =>
        `${m.role === 'user' ? 'User' : 'Assistant'}: ${
          typeof m.content === 'string' ? m.content : '[complex content]'
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
        content: `Summarize the following conversation concisely, preserving all important information, the user's core needs, and any resolved or unresolved issues. Write in third person, under 200 words.

Conversation:
${conversationText}`,
      },
    ],
  });

  return response.choices[0]?.message.content ?? '';
}

/**
 * Get a processed message list (automatically handles context overflow)
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

  // Under the limit — return the full history
  if (estimatedTokens < COMPRESSION_THRESHOLD_TOKENS) {
    return {
      messages: allParams,
      summary: existingSummary ?? null,
      compressed: false,
    };
  }

  // Over the limit: keep recent turns, compress earlier ones
  const recentMessages = allParams.slice(-RECENT_TURNS_TO_KEEP * 2);
  const olderMessages = allParams.slice(0, -RECENT_TURNS_TO_KEEP * 2);

  if (olderMessages.length === 0) {
    // Even the recent turns exceed the limit — truncate only
    return {
      messages: recentMessages,
      summary: existingSummary ?? null,
      compressed: true,
    };
  }

  // Generate a summary (if a previous summary exists, include it with the new older messages)
  const messagesToSummarizeList = existingSummary
    ? [
        { role: 'user' as const, content: `[Previous conversation summary] ${existingSummary}` },
        ...olderMessages,
      ]
    : olderMessages;

  const newSummary = await summarizeMessages(messagesToSummarizeList);

  // Inject the summary as context background
  const contextWithSummary: ChatCompletionMessageParam[] = [
    {
      role: 'user',
      content: `[Conversation background summary]\n${newSummary}\n\nHere are the most recent exchanges:`,
    },
    { role: 'assistant', content: 'Understood. I have the context from our earlier conversation. Please continue.' },
    ...recentMessages,
  ];

  // Persist the updated summary to the database
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
// #endbook
