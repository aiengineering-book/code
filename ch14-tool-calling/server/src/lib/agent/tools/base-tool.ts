// packages/server/src/lib/agent/tools/base-tool.ts
// #book ch14-base-tool
// ch14-tool-calling/server/src/lib/agent/tools/base-tool.ts
import type { z } from 'zod';
import type { Tool } from '../react-agent.js';

export interface ToolExecuteResult {
  success: boolean;
  data?: unknown;
  error?: {
    code: string;
    message: string;
    retryable: boolean; // Worth retrying?
  };
}

/**
 * Base class for tools with Zod validation.
 * inputSchema is for OpenAI (JSON Schema); zodSchema is for internal validation.
 */
export abstract class ValidatedTool<TInput, TOutput> implements Tool {
  abstract readonly name: string;
  abstract readonly description: string;
  // JSON Schema — provided to OpenAI Function Calling
  abstract readonly inputSchema: Record<string, unknown>;
  // Third type param set to unknown for compatibility with ZodDefault and other schemas with defaults
  // Zod schema — for runtime validation, not exposed to OpenAI
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected abstract readonly zodSchema: z.ZodType<TInput, z.ZodTypeDef, any>;
  abstract readonly outputSchema: z.ZodType<TOutput>;

  async execute(rawInput: Record<string, unknown>): Promise<string> {
    // 1. Validate input
    const inputResult = this.zodSchema.safeParse(rawInput);
    if (!inputResult.success) {
      return JSON.stringify({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: `Parameter validation failed: ${JSON.stringify(inputResult.error.flatten().fieldErrors)}`,
          retryable: true,
        },
      });
    }

    // 2. Run core logic
    let rawOutput: unknown;
    try {
      rawOutput = await this.run(inputResult.data);
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: {
          code: 'EXECUTION_ERROR',
          message: error instanceof Error ? error.message : String(error),
          retryable: this.isRetryableError(error),
        },
      });
    }

    // 3. Validate output
    const outputResult = this.outputSchema.safeParse(rawOutput);
    if (!outputResult.success) {
      console.error(`[${this.name}] Output validation failed:`, outputResult.error);
      // Output validation failure usually indicates a bug — log but return anyway
      return JSON.stringify({ success: true, data: rawOutput });
    }

    return JSON.stringify({ success: true, data: outputResult.data });
  }

  protected abstract run(input: TInput): Promise<TOutput>;

  protected isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      // Network errors are usually retryable
      return (
        error.message.includes('timeout') ||
        error.message.includes('network') ||
        error.message.includes('ECONNREFUSED')
      );
    }
    return false;
  }
}
// #endbook
