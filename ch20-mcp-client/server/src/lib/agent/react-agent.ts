// Stub: minimal ReActAgent interface from ch13 for ch20 MCP Client integration.
// Full implementation: ch13-agent.

import OpenAI from 'openai';

export interface Tool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, { type: string; description: string }>;
    required: string[];
  };
  execute: (args: Record<string, unknown>) => Promise<string>;
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
}

export class ReActAgent {
  private tools: Tool[];
  private maxSteps: number;
  private onStep: ((step: AgentStep) => Promise<void>) | undefined;
  private client: OpenAI;

  constructor(options: {
    tools: Tool[];
    maxSteps?: number | undefined;
    onStep?: ((step: AgentStep) => Promise<void>) | undefined;
  }) {
    this.tools = options.tools;
    this.maxSteps = options.maxSteps ?? 10;
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
      {
        role: 'system',
        content:
          "You are a ReAct Agent. Think through the user's task and use tools to complete it.",
      },
      { role: 'user', content: task },
    ];

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
        await this.onStep?.(answerStep);
        return { answer, steps };
      }

      for (const toolCall of message.tool_calls) {
        if (toolCall.type !== 'function') continue;

        const fnCall = toolCall.function;
        const tool = this.tools.find((t) => t.name === fnCall.name);
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
        await this.onStep?.(callStep);

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
        await this.onStep?.(resultStep);

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: result,
        });
      }
    }

    return { answer: 'Max step limit reached', steps };
  }
}
