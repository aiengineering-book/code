import type { ZodRawShape } from 'zod';

export interface Tool<TShape extends ZodRawShape = ZodRawShape> {
  name: string;
  description: string;
  inputSchema: TShape; // Zod shape，不是 JSON Schema
  execute: (args: Record<string, unknown>) => Promise<string>;
}
