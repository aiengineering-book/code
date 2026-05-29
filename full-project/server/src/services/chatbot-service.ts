// #book-ref ch08-chatbot-service
// ch08-conversation/server/src/services/chatbot-service.ts
import { estimateCost, trackUsage } from '../lib/cost.js';
import { DEFAULT_MODEL, openai } from '../lib/openai.js';
import { getManagedContext } from './context-manager.js';
import { conversationService } from './conversation-service.js';

const CUSTOMER_SERVICE_SYSTEM = `
# Role

You are Aria, the intelligent customer service assistant for TechShop. Professional, friendly, and efficient.

# What you handle

- Order lookup and shipment tracking
- Return and exchange requests and status updates
- Product information and stock inquiries
- Discounts, promotions, and loyalty points

# Behavior guidelines

- Keep each response under 150 words
- For issues you can't resolve, proactively offer to transfer to a human agent
- For information you're unsure about, say "I'll need to verify that and get back to you"
- For refund timelines, say only "3-7 business days" — don't commit to specific dates

# Response style

Warm, conversational tone. End with a brief follow-up offer.
`.trim();

export class ChatbotService {
  /**
   * Non-streaming reply (for testing and simple scenarios)
   */
  async reply(
    conversationId: string,
    userId: string,
    userMessage: string,
  ): Promise<string> {
    // 1. Save the user message
    await conversationService.saveMessage({
      conversationId,
      role: 'user',
      content: userMessage,
    });

    // 2. Fetch conversation history
    const conversation = await conversationService.getById(
      conversationId,
      userId,
    );
    const dbMessages = await conversationService.getMessages(conversationId);

    // 3. Manage context (automatic compression)
    const { messages } = await getManagedContext(
      conversationId,
      dbMessages,
      conversation.summary,
    );

    // 4. Call the LLM
    const response = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      max_completion_tokens: 1024,
      messages: [
        { role: 'system', content: CUSTOMER_SERVICE_SYSTEM },
        ...messages,
      ],
    });

    const assistantReply = response.choices[0]?.message.content ?? '';

    // 5. Save the assistant reply (with token usage)
    await conversationService.saveMessage({
      conversationId,
      role: 'assistant',
      content: assistantReply,
      inputTokens: response.usage?.prompt_tokens,
      outputTokens: response.usage?.completion_tokens,
    });

    // 6. Track cost
    await trackUsage({
      userId,
      model: DEFAULT_MODEL,
      inputTokens: response.usage?.prompt_tokens ?? 0,
      outputTokens: response.usage?.completion_tokens ?? 0,
      costUsd: estimateCost(
        DEFAULT_MODEL,
        response.usage?.prompt_tokens ?? 0,
        response.usage?.completion_tokens ?? 0,
      ),
      endpoint: 'chatbot',
    });

    return assistantReply;
  }

  /**
   * Streaming reply — returns an AsyncGenerator
   */
  async *replyStream(
    conversationId: string,
    userId: string,
    userMessage: string,
  ): AsyncGenerator<
    | { type: 'delta'; text: string }
    | { type: 'done'; inputTokens: number; outputTokens: number }
  > {
    // Save the user message
    await conversationService.saveMessage({
      conversationId,
      role: 'user',
      content: userMessage,
    });

    // Get context
    const conversation = await conversationService.getById(
      conversationId,
      userId,
    );
    const dbMessages = await conversationService.getMessages(conversationId);
    const { messages } = await getManagedContext(
      conversationId,
      dbMessages,
      conversation.summary,
    );

    // Streaming call
    const stream = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      max_completion_tokens: 1024,
      stream: true,
      stream_options: { include_usage: true },
      messages: [
        { role: 'system', content: CUSTOMER_SERVICE_SYSTEM },
        ...messages,
      ],
    });

    let fullText = '';
    let input_tokens = 0;
    let output_tokens = 0;

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        fullText += delta;
        yield { type: 'delta', text: delta };
      }
      // Last chunk carries usage
      if (chunk.usage) {
        input_tokens = chunk.usage.prompt_tokens;
        output_tokens = chunk.usage.completion_tokens;
      }
    }

    // Save the complete reply
    await conversationService.saveMessage({
      conversationId,
      role: 'assistant',
      content: fullText,
      inputTokens: input_tokens,
      outputTokens: output_tokens,
    });

    await trackUsage({
      userId,
      model: DEFAULT_MODEL,
      inputTokens: input_tokens,
      outputTokens: output_tokens,
      costUsd: estimateCost(DEFAULT_MODEL, input_tokens, output_tokens),
      endpoint: 'chatbot-stream',
    });

    yield {
      type: 'done',
      inputTokens: input_tokens,
      outputTokens: output_tokens,
    };
  }
}

export const chatbotService = new ChatbotService();
