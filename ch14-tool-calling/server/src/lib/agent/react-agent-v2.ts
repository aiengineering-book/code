// packages/server/src/lib/agent/react-agent-v2.ts
// Extends ch13 ReActAgent with parallel tool support, migrated to OpenAI Function Calling protocol

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

  // Convert Tool[] to OpenAI Function Calling format
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

  // Append the assistant reply (including tool_calls) to history
      messages.push(message);

    // Only handle function-type tool calls
      const toolCalls = (message.tool_calls ?? []).filter(
        (tc): tc is FunctionToolCall => tc.type === 'function',
      );

      // No tool calls = model has produced a final answer
      if (toolCalls.length === 0) {
      const answer = message.content ?? 'Task complete, but no explicit answer.';
        const finalStep: AgentStep = { type: 'final_answer', content: answer };
        steps.push(finalStep);
        onStep?.(finalStep);
        return { answer, steps, totalSteps: step + 1, stopped: 'answer' };
      }

    // Cycle detection: track before each tool execution
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
              : 'Abnormal call pattern detected — aborted';
          return {
            answer: errMsg,
            steps,
            totalSteps: step + 1,
            stopped: 'error',
          };
        }
      }

  // Execute all tool calls in parallel
      const execResults = await executeToolsParallel(toolCalls, tools, {
        maxConcurrency,
        timeoutMs,
      });

      // Record the execution step for each tool
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
            `[Agent] tool ${r.toolName} took ${r.durationMs}ms — consider optimizing`,
          );
        }
      }

    // Append tool results as role: 'tool' messages to history
      const toolMessages = resultsToToolMessages(execResults);
      messages.push(...toolMessages);
    }

    // Max steps reached
    const lastResults = steps
      .filter((s) => s.type === 'tool_result')
      .map((s) => s.content)
      .join('\n\n');

    return {
        answer: `Max step limit reached. Here is the progress so far:\n\n${lastResults}`,
      steps,
      totalSteps: maxSteps,
      stopped: 'max_steps',
    };
  }
}
