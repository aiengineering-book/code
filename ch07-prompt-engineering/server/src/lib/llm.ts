// Stub — implement with your OpenAI client (see ch06-llm-api)
export interface LLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface LLMOptions {
  system?: string;
  temperature?: number;
  maxTokens?: number;
}

export async function callLLM(
  // biome-ignore lint/correctness/noUnusedFunctionParameters: for demo
  messages: LLMMessage[],
  // biome-ignore lint/correctness/noUnusedFunctionParameters: for demo
  options?: LLMOptions,
): Promise<{ text: string }> {
  throw new Error('callLLM not implemented — wire up your OpenAI client here');
}
