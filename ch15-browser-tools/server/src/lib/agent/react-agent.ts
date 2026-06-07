// ReActAgent adapted from ch13/ch14 for ch15 tool integration.
// Full implementation: ch13-agent / ch14-tool-calling.

import OpenAI from 'openai';

export interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (params: Record<string, unknown>) => Promise<string>;
}

export interface AgentStep {
  type: 'thinking' | 'tool_call' | 'tool_result' | 'answer';
  content: string;
  toolName?: string | undefined;
  toolArgs?: Record<string, unknown> | undefined;
}

export interface AgentResult {
  answer: string;
  steps: AgentStep[];
  totalSteps: number;
  stopped: string;
}

export class ReActAgent {
  private tools: Tool[];
  private maxSteps: number;
  private systemPrompt: string;
  private onStep: ((step: AgentStep) => void) | undefined;
  private client: OpenAI;

  constructor(options: {
    tools: Tool[];
    maxSteps?: number | undefined;
    systemPrompt?: string | undefined;
    onStep?: ((step: AgentStep) => void) | undefined;
  }) {
    this.tools = options.tools;
    this.maxSteps = options.maxSteps ?? 10;
    this.systemPrompt =
      options.systemPrompt ??
      'You are an AI assistant that can use tools to solve problems.';
    this.onStep = options.onStep;
    this.client = new OpenAI();
  }

  async run(task: string): Promise<AgentResult> {
    const steps: AgentStep[] = [];

    const openaiTools: OpenAI.Chat.Completions.ChatCompletionTool[] =
      this.tools.map((t) => ({
        type: 'function' as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.inputSchema,
        },
      }));

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: this.systemPrompt },
      { role: 'user', content: task },
    ];

    let stopped = 'completed';

    for (let i = 0; i < this.maxSteps; i++) {
      const params: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming =
        {
          model: 'gpt-4o-mini',
          messages,
        };
      if (openaiTools.length > 0) {
        params.tools = openaiTools;
      }

      const response = await this.client.chat.completions.create(params);
      const choice = response.choices[0];
      if (!choice) break;

      const message = choice.message;
      messages.push(message);

      if (!message.tool_calls || message.tool_calls.length === 0) {
        const answer = message.content ?? '';
        const answerStep: AgentStep = { type: 'answer', content: answer };
        steps.push(answerStep);
        this.onStep?.(answerStep);
        return { answer, steps, totalSteps: steps.length, stopped };
      }

      for (const toolCall of message.tool_calls) {
        if (toolCall.type !== 'function') continue;
        const fnCall = toolCall.function;
        const parsedArgs = JSON.parse(fnCall.arguments) as Record<
          string,
          unknown
        >;

        const callStep: AgentStep = {
          type: 'tool_call',
          content: `Calling tool ${fnCall.name}`,
          toolName: fnCall.name,
          toolArgs: parsedArgs,
        };
        steps.push(callStep);
        this.onStep?.(callStep);

        const tool = this.tools.find((t) => t.name === fnCall.name);
        let result: string;
        try {
          result = tool
            ? await tool.execute(parsedArgs)
            : `Tool ${fnCall.name} not found`;
        } catch (err) {
          result = `Tool execution failed: ${err instanceof Error ? err.message : String(err)}`;
        }

        const resultStep: AgentStep = { type: 'tool_result', content: result };
        steps.push(resultStep);
        this.onStep?.(resultStep);

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: result,
        });
      }
    }

    stopped = 'max_steps';
    return {
      answer: 'Max step limit reached',
      steps,
      totalSteps: steps.length,
      stopped,
    };
  }
}
