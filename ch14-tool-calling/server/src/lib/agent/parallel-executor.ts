// packages/server/src/lib/agent/parallel-executor.ts
// #book ch14-parallel-executor
import type { ChatCompletionMessageToolCall } from 'openai/resources/chat/completions.js';
// ch14-tool-calling/server/src/lib/agent/parallel-executor.ts
import type { Tool } from './react-agent.js';

// OpenAI SDK 中 tool_calls 是联合类型，仅处理 function 类型调用
type FunctionToolCall = Extract<
  ChatCompletionMessageToolCall,
  { type: 'function' }
>;

export interface ParallelExecutionResult {
  toolCallId: string;
  toolName: string;
  input: Record<string, unknown>;
  result: string;
  error?: string;
  durationMs: number;
}

/**
 * 并行执行所有工具调用，收集结果
 */
export async function executeToolsParallel(
  toolCalls: FunctionToolCall[],
  tools: Tool[],
  options: {
    maxConcurrency?: number; // 最大并发数，防止过多并发
    timeoutMs?: number; // 单个工具的超时时间
  } = {},
): Promise<ParallelExecutionResult[]> {
  const { maxConcurrency = 5, timeoutMs = 30_000 } = options;

  // 按批次并行执行，控制最大并发
  const results: ParallelExecutionResult[] = [];

  for (let i = 0; i < toolCalls.length; i += maxConcurrency) {
    const batch = toolCalls.slice(i, i + maxConcurrency);

    const batchResults = await Promise.all(
      batch.map(async (call) => {
        const start = Date.now();
        const tool = tools.find((t) => t.name === call.function.name);
        // OpenAI 的 arguments 是 JSON 字符串，需要解析
        const input = JSON.parse(call.function.arguments) as Record<
          string,
          unknown
        >;

        if (!tool) {
          return {
            toolCallId: call.id,
            toolName: call.function.name,
            input,
            result: `错误：工具 "${call.function.name}" 不存在`,
            error: 'TOOL_NOT_FOUND',
            durationMs: Date.now() - start,
          };
        }

        try {
          // 带超时的工具执行
          const result = await Promise.race([
            tool.execute(input),
            new Promise<never>((_, reject) =>
              setTimeout(
                () => reject(new Error(`工具执行超时（${timeoutMs}ms）`)),
                timeoutMs,
              ),
            ),
          ]);

          return {
            toolCallId: call.id,
            toolName: call.function.name,
            input,
            result,
            durationMs: Date.now() - start,
          };
        } catch (error) {
          return {
            toolCallId: call.id,
            toolName: call.function.name,
            input,
            result: `工具执行失败：${error instanceof Error ? error.message : String(error)}`,
            error: 'EXECUTION_ERROR',
            durationMs: Date.now() - start,
          };
        }
      }),
    );

    results.push(...batchResults);
  }

  return results;
}

/**
 * 将执行结果转换为 OpenAI API 需要的 tool 消息格式
 */
export type { FunctionToolCall };

export function resultsToToolMessages(
  results: ParallelExecutionResult[],
): Array<{ role: 'tool'; tool_call_id: string; content: string }> {
  return results.map((r) => ({
    role: 'tool' as const,
    tool_call_id: r.toolCallId,
    content: r.error ? JSON.stringify({ error: r.result }) : r.result,
  }));
}

// #endbook
