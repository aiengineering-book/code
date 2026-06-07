// ch14-tool-calling/server/src/lib/agent/parallel-executor.ts
// #book ch14-parallel-executor
// ch14-tool-calling/server/src/lib/agent/parallel-executor.ts
import type { ChatCompletionMessageToolCall } from 'openai/resources/chat/completions.js';
import type { Tool } from './react-agent.js';

// OpenAI SDK's tool_calls is a union type — only handle function type calls
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
 * Execute all tool calls in parallel and collect results
 */
export async function executeToolsParallel(
  toolCalls: FunctionToolCall[],
  tools: Tool[],
  options: {
    maxConcurrency?: number; // Max concurrent executions
    timeoutMs?: number; // Per-tool timeout
  } = {},
): Promise<ParallelExecutionResult[]> {
  const { maxConcurrency = 5, timeoutMs = 30_000 } = options;

  // Execute in batches in parallel, capping max concurrency
  const results: ParallelExecutionResult[] = [];

  for (let i = 0; i < toolCalls.length; i += maxConcurrency) {
    const batch = toolCalls.slice(i, i + maxConcurrency);

    const batchResults = await Promise.all(
      batch.map(async (call) => {
        const start = Date.now();
        const tool = tools.find((t) => t.name === call.function.name);
        // OpenAI's arguments is a JSON string — parse it
        const input = JSON.parse(call.function.arguments) as Record<
          string,
          unknown
        >;

        if (!tool) {
          return {
            toolCallId: call.id,
            toolName: call.function.name,
            input,
            result: `Error: tool "${call.function.name}" does not exist`,
            error: 'TOOL_NOT_FOUND',
            durationMs: Date.now() - start,
          };
        }

        try {
          // Tool execution with timeout
          const result = await Promise.race([
            tool.execute(input),
            new Promise<never>((_, reject) =>
              setTimeout(
                () =>
                  reject(
                    new Error(`Tool execution timed out (${timeoutMs}ms)`),
                  ),
                timeoutMs,
              ),
            ),
          ]);

          return {
            toolCallId: call.id,
            toolName: call.function.name,
            input,
            result: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
            durationMs: Date.now() - start,
          };
        } catch (error) {
          return {
            toolCallId: call.id,
            toolName: call.function.name,
            input,
            result: `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`,
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

export type { FunctionToolCall };

/**
 * Convert execution results to the OpenAI API's tool message format
 */
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
