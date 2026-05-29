// #book ch08-chatbot-service
import { estimateCost, trackUsage } from '../lib/cost.js';
// ch08-conversation/server/src/services/chatbot-service.ts
import { DEFAULT_MODEL, openai } from '../lib/openai.js';
import { getManagedContext } from './context-manager.js';
import { conversationService } from './conversation-service.js';

const CUSTOMER_SERVICE_SYSTEM = `
# 角色

你是「极客商城」的智能客服助手小极。专业、友善、高效。

# 你能处理的问题

- 订单查询与物流跟踪
- 退换货申请与进度查询
- 商品信息与库存咨询
- 优惠活动与积分规则

# 行为规范

- 每次回复控制在 200 字以内
- 无法处理的问题，主动提出转接人工客服
- 不确定的信息，告知用户"我需要核实后回复您"
- 涉及退款金额，只说"1-7个工作日到账"，不承诺具体时间

# 回复格式

使用友好的口语化中文，结尾可以加一句关怀性的话语。
`.trim();

export class ChatbotService {
  /**
   * 非流式回复（用于测试和简单场景）
   */
  async reply(
    conversationId: string,
    userId: string,
    userMessage: string,
  ): Promise<string> {
    // 1. 保存用户消息
    await conversationService.saveMessage({
      conversationId,
      role: 'user',
      content: userMessage,
    });

    // 2. 获取会话历史
    const conversation = await conversationService.getById(
      conversationId,
      userId,
    );
    const dbMessages = await conversationService.getMessages(conversationId);

    // 3. 管理上下文（自动压缩）
    const { messages } = await getManagedContext(
      conversationId,
      dbMessages,
      conversation.summary,
    );

    // 4. 调用 LLM
    const response = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      max_completion_tokens: 1024,
      messages: [
        { role: 'system', content: CUSTOMER_SERVICE_SYSTEM },
        ...messages,
      ],
    });

    const assistantReply = response.choices[0]?.message.content ?? '';

    // 5. 保存助手回复（含 Token 用量）
    await conversationService.saveMessage({
      conversationId,
      role: 'assistant',
      content: assistantReply,
      inputTokens: response.usage?.prompt_tokens,
      outputTokens: response.usage?.completion_tokens,
    });

    // 6. 追踪成本
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
   * 流式回复，返回 AsyncGenerator
   */
  async *replyStream(
    conversationId: string,
    userId: string,
    userMessage: string,
  ): AsyncGenerator<
    | { type: 'delta'; text: string }
    | { type: 'done'; inputTokens: number; outputTokens: number }
  > {
    // 保存用户消息
    await conversationService.saveMessage({
      conversationId,
      role: 'user',
      content: userMessage,
    });

    // 获取上下文
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

    // 流式调用
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
      // 最后一个 chunk 带 usage 信息
      if (chunk.usage) {
        input_tokens = chunk.usage.prompt_tokens;
        output_tokens = chunk.usage.completion_tokens;
      }
    }

    // 保存完整回复
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
// #endbook
