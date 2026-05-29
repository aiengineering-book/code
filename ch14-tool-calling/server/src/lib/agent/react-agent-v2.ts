// packages/server/src/lib/agent/react-agent-v2.ts
// 在第 13 章 ReActAgent 基础上升级并行支持，改用 OpenAI Function Calling 协议

import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from 'openai/resources/chat/completions.js';
import { DEFAULT_MODEL, openai } from '../openai.js';
import { ToolCallTracker } from './call-tracker.js';
import type { FunctionToolCall } from './parallel-executor.js';
import {
  executeToolsParallel,
  resultsToToolMessages,
} from './parallel-executor.js';
import type { AgentStep, Tool } from './react-agent.js';

export interface AgentConfig {
  tools: Tool[];
  maxSteps?: number;
  onStep?: (step: AgentStep) => void;
  systemPrompt?: string;
  maxConcurrency?: number;
  timeoutMs?: number;
}

export interface AgentResult {
  answer: string;
  steps: AgentStep[];
  totalSteps: number;
  stopped: 'answer' | 'max_steps' | 'error';
}

export class ReActAgentV2 {
  constructor(private config: AgentConfig) {}

  async run(userMessage: string): Promise<AgentResult> {
    const {
      tools,
      maxSteps = 10,
      onStep,
      systemPrompt,
      maxConcurrency = 3,
      timeoutMs = 30_000,
    } = this.config;

    const steps: AgentStep[] = [];

    const tracker = new ToolCallTracker({
      maxSameToolCalls: 3,
      maxTotalCalls: 20,
    });

    // 将 Tool[] 转换为 OpenAI Function Calling 格式
    const openaiTools: ChatCompletionTool[] = tools.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.inputSchema,
      },
    }));

    const messages: ChatCompletionMessageParam[] = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: userMessage });

    for (let step = 0; step < maxSteps; step++) {
      const response = await openai.chat.completions.create({
        model: DEFAULT_MODEL,
        max_completion_tokens: 2048,
        tools: openaiTools,
        messages,
      });

      const message = response.choices[0]?.message;
      if (!message) break;

      // 把 assistant 的回复（含 tool_calls）加入历史
      messages.push(message);

      // 只处理 function 类型的工具调用
      const toolCalls = (message.tool_calls ?? []).filter(
        (tc): tc is FunctionToolCall => tc.type === 'function',
      );

      // 没有工具调用 = 模型已生成最终回答
      if (toolCalls.length === 0) {
        const answer = message.content ?? '任务完成，但没有明确的答案。';
        const finalStep: AgentStep = { type: 'final_answer', content: answer };
        steps.push(finalStep);
        onStep?.(finalStep);
        return { answer, steps, totalSteps: step + 1, stopped: 'answer' };
      }

      // 循环检测：每次执行工具前追踪
      for (const call of toolCalls) {
        try {
          const input = JSON.parse(call.function.arguments) as Record<
            string,
            unknown
          >;
          tracker.track(call.function.name, input);
        } catch (error) {
          const errMsg =
            error instanceof Error
              ? error.message
              : '检测到异常调用模式，已中止';
          return {
            answer: errMsg,
            steps,
            totalSteps: step + 1,
            stopped: 'error',
          };
        }
      }

      // 并行执行所有工具调用
      const execResults = await executeToolsParallel(toolCalls, tools, {
        maxConcurrency,
        timeoutMs,
      });

      // 记录每个工具的执行步骤
      for (const r of execResults) {
        const toolStep: AgentStep = {
          type: 'tool_result',
          content: r.result,
          toolName: r.toolName,
        };
        steps.push(toolStep);
        onStep?.(toolStep);

        if (r.durationMs > 5000) {
          console.warn(
            `[Agent] 工具 ${r.toolName} 执行耗时 ${r.durationMs}ms，考虑优化`,
          );
        }
      }

      // 将工具结果以 role: 'tool' 消息格式追加到历史
      const toolMessages = resultsToToolMessages(execResults);
      messages.push(...toolMessages);
    }

    // 达到最大步数
    const lastResults = steps
      .filter((s) => s.type === 'tool_result')
      .map((s) => s.content)
      .join('\n\n');

    return {
      answer: `已达到最大步数限制，以下是目前的进展：\n\n${lastResults}`,
      steps,
      totalSteps: maxSteps,
      stopped: 'max_steps',
    };
  }
}
