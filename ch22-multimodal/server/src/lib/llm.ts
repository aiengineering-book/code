// Stub: 完整实现见 ch06
import { DEFAULT_MODEL, openai } from './openai.js';

export async function callLLM(
  messages: Array<{ role: string; content: unknown }>,
  options?: { temperature?: number; system?: string },
): Promise<string> {
  const msgs: Array<{ role: 'system' | 'user' | 'assistant'; content: any }> =
    [];
  if (options?.system) msgs.push({ role: 'system', content: options.system });
  for (const m of messages) {
    msgs.push({ role: m.role as 'user', content: m.content as any });
  }
  const params: Record<string, unknown> = {
    model: DEFAULT_MODEL,
    messages: msgs,
  };
  if (options?.temperature !== undefined)
    params.temperature = options.temperature;
  const response = await openai.chat.completions.create(params as any);
  return response.choices[0]?.message?.content ?? '';
}
