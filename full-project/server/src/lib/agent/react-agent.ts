import { DEFAULT_MODEL, openai } from '../openai.js';

export interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (params: unknown) => Promise<string>;
}

export interface AgentStep {
  type:
    | 'thought'
    | 'action'
    | 'tool_call'
    | 'observation'
    | 'tool_result'
    | 'final_answer'
    | 'answer';
  content: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
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
  private constructorOnStep?:
    | ((step: AgentStep) => void | Promise<void>)
    | undefined;

  constructor(options: {
    tools: Tool[];
    maxSteps?: number;
    maxTokens?: number;
    systemPrompt?: string;
    onStep?: ((step: AgentStep) => void | Promise<void>) | undefined;
  }) {
    this.tools = options.tools;
    this.maxSteps = options.maxSteps ?? 10;
    this.systemPrompt = options.systemPrompt;
    this.constructorOnStep = options.onStep;
  }

  async run(
    userMessage: string,
    options?: {
      signal?: AbortSignal | undefined;
      onStep?: ((step: AgentStep) => void | Promise<void>) | undefined;
    },
  ): Promise<AgentResult> {
    const onStep = options?.onStep ?? this.constructorOnStep;

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
    const step: AgentStep = { type: 'final_answer', content: text };

    if (onStep) await onStep(step);

    return { answer: text, output: text, steps: [step] };
  }
}
