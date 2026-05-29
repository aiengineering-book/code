// Stub: ReActAgent interface used by ch16; full implementation in ch13
import { DEFAULT_MODEL, openai } from '../openai.js';

export interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (params: unknown) => Promise<string>;
}

export interface AgentStep {
  type: 'thought' | 'action' | 'observation' | 'final_answer';
  content: string;
  tokensUsed?: number;
}

export interface AgentResult {
  answer: string;
  output: string;
  stopped?: 'error' | 'maxSteps';
  steps: AgentStep[];
}

export class ReActAgent {
  private tools: Tool[];
  private maxSteps: number;
  private systemPrompt?: string | undefined;

  constructor(options: {
    tools: Tool[];
    maxSteps?: number;
    maxTokens?: number;
    systemPrompt?: string;
  }) {
    this.tools = options.tools;
    this.maxSteps = options.maxSteps ?? 10;
    this.systemPrompt = options.systemPrompt;
  }

  async run(
    userMessage: string,
    _options?: {
      signal?: AbortSignal | undefined;
      onStep?: ((step: AgentStep) => void) | undefined;
    },
  ): Promise<AgentResult> {
    // Simplified: calls LLM directly, skips the full ReAct loop
    const toolDesc = this.tools
      .map((t) => `${t.name}: ${t.description}`)
      .join('\n');

    const response = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [
        ...(this.systemPrompt
          ? [{ role: 'system' as const, content: this.systemPrompt }]
          : []),
        {
          role: 'user' as const,
          content: `Available tools:\n${toolDesc}\n\n${userMessage}`,
        },
      ],
    });

    const text = response.choices[0]?.message?.content ?? '';
    return { answer: text, output: text, steps: [] };
  }
}
