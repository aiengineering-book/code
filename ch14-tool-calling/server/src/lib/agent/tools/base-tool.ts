// packages/server/src/lib/agent/tools/base-tool.ts
// #book ch14-base-tool
import type { z } from 'zod';
// ch14-tool-calling/server/src/lib/agent/tools/base-tool.ts
import type { Tool } from '../react-agent.js';

export interface ToolExecuteResult {
  success: boolean;
  data?: unknown;
  error?: {
    code: string;
    message: string;
    retryable: boolean; // 是否值得重试
  };
}

/**
 * 带 Zod 验证的工具基类。
 * inputSchema 给 OpenAI 用（JSON Schema），zodSchema 做内部输入验证。
 */
export abstract class ValidatedTool<TInput, TOutput> implements Tool {
  abstract readonly name: string;
  abstract readonly description: string;
  // JSON Schema，提供给 OpenAI Function Calling
  abstract readonly inputSchema: Record<string, unknown>;
  // Zod schema，用于运行时验证，不暴露给 OpenAI
  // 第三个类型参数设为 unknown 以兼容 ZodDefault 等带默认值的 schema
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected abstract readonly zodSchema: z.ZodType<TInput, z.ZodTypeDef, any>;
  abstract readonly outputSchema: z.ZodType<TOutput>;

  async execute(rawInput: Record<string, unknown>): Promise<string> {
    // 1. 验证输入
    const inputResult = this.zodSchema.safeParse(rawInput);
    if (!inputResult.success) {
      return JSON.stringify({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: `参数验证失败：${JSON.stringify(inputResult.error.flatten().fieldErrors)}`,
          retryable: true,
        },
      });
    }

    // 2. 执行核心逻辑
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

    // 3. 验证输出
    const outputResult = this.outputSchema.safeParse(rawOutput);
    if (!outputResult.success) {
      console.error(`[${this.name}] 输出验证失败：`, outputResult.error);
      // 输出验证失败通常是 bug，记录日志但仍返回原始结果
      return JSON.stringify({ success: true, data: rawOutput });
    }

    return JSON.stringify({ success: true, data: outputResult.data });
  }

  protected abstract run(input: TInput): Promise<TOutput>;

  protected isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      // 网络错误通常可以重试
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
