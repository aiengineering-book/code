// ReActAgent adapted from ch13 for ch17 tool interface
import { DEFAULT_MODEL, openai } from '../openai.js';

export interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (params: unknown) => Promise<string>;
}

export interface AgentStep {
  type: 'thought' | 'action' | 'observation' | 'final_answer' | 'tool_result';
  content: string;
  toolName?: string;
  tokensUsed?: number;
}

export interface AgentResult {
  answer: string;
  output: string;
  stopped?: 'error' | 'maxSteps';
  steps: AgentStep[];
}

export class ReActAgent {
  private tools: Map<string, Tool>;
  private maxSteps: number;
  private systemPrompt: string | undefined;
  private onStep: ((step: AgentStep) => void) | undefined;
  private maxTokens: number;

  constructor(options: {
    tools: Tool[];
    maxSteps?: number;
    maxTokens?: number;
    systemPrompt?: string;
    onStep?: ((step: AgentStep) => void) | undefined;
  }) {
    this.tools = new Map(options.tools.map((t) => [t.name, t]));
    this.maxSteps = options.maxSteps ?? 10;
    this.maxTokens = options.maxTokens ?? 2048;
    this.systemPrompt = options.systemPrompt;
    this.onStep = options.onStep;
  }

  private buildSystemPrompt(): string {
    const toolDescriptions = Array.from(this.tools.values())
      .map(
        (t) =>
          `Tool name: ${t.name}\nDescription: ${t.description}\nParameters: ${JSON.stringify(t.inputSchema, null, 2)}`,
      )
      .join('\n\n---\n\n');

    const customPart = this.systemPrompt ? `\n\n${this.systemPrompt}` : '';

    return `
  You are an AI assistant that can use tools to solve problems. ${customPart}

  # Available Tools

${toolDescriptions}

  # Workflow

  For every reply, you MUST respond in the following format:

<thought>
  Analyze the current situation and decide the next action
</thought>

<action>
{
    "tool": "tool_name",
    "params": { "param_name": "param_value" }
}
</action>

  When you have enough information to answer the user, output:

<thought>
  I now have enough information to answer this question
</thought>

<final_answer>
  Final answer content
</final_answer>

  # Important Rules

  1. Call only one tool at a time
  2. Carefully examine the tool's return value before deciding the next step
  3. If a tool fails, retry with different parameters or use another tool
  4. Execute at most ${this.maxSteps} steps; if exceeded, give your best current answer
  5. Never fabricate tool call results
`.trim();
  }

  private parseOutput(text: string): {
    thought: string | undefined;
    action: { tool: string; params: Record<string, unknown> } | undefined;
    finalAnswer: string | undefined;
  } {
    const thought = text.match(/<thought>([\s\S]*?)<\/thought>/)?.[1]?.trim();
    const actionText = text.match(/<action>([\s\S]*?)<\/action>/)?.[1]?.trim();
    const finalAnswer = text
      .match(/<final_answer>([\s\S]*?)<\/final_answer>/)?.[1]
      ?.trim();

    let action: { tool: string; params: Record<string, unknown> } | undefined;
    if (actionText) {
      try {
        action = JSON.parse(actionText);
      } catch {
        const toolMatch = actionText.match(/"tool"\s*:\s*"([^"]+)"/);
        if (toolMatch) {
          action = { tool: toolMatch[1]!, params: {} };
        }
      }
    }

    return { thought, action, finalAnswer };
  }

  async run(
    userMessage: string,
    options?: {
      signal?: AbortSignal | undefined;
      onStep?: ((step: AgentStep) => void) | undefined;
    },
  ): Promise<AgentResult> {
    const onStep = options?.onStep ?? this.onStep;
    const steps: AgentStep[] = [];

    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
      { role: 'user', content: userMessage },
    ];

    const systemPrompt = this.buildSystemPrompt();

    for (let step = 0; step < this.maxSteps; step++) {
      const response = await openai.chat.completions.create({
        model: DEFAULT_MODEL,
        max_completion_tokens: this.maxTokens,
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
      });

      const assistantText = response.choices[0]?.message?.content ?? '';
      messages.push({ role: 'assistant', content: assistantText });

      const parsed = this.parseOutput(assistantText);

      if (parsed.thought) {
        const thoughtStep: AgentStep = {
          type: 'thought',
          content: parsed.thought,
        };
        steps.push(thoughtStep);
        onStep?.(thoughtStep);
      }

      // Final answer
      if (parsed.finalAnswer) {
        const finalStep: AgentStep = {
          type: 'final_answer',
          content: parsed.finalAnswer,
        };
        steps.push(finalStep);
        onStep?.(finalStep);
        return {
          answer: parsed.finalAnswer,
          output: parsed.finalAnswer,
          steps,
        };
      }

      // Tool call
      if (parsed.action) {
        const { tool: toolName, params } = parsed.action;
        const tool = this.tools.get(toolName);

        const actionStep: AgentStep = {
          type: 'action',
          content: `Calling tool: ${toolName}`,
          toolName,
        };
        steps.push(actionStep);
        onStep?.(actionStep);

        let observationContent: string;

        if (!tool) {
          observationContent = `Error: tool "${toolName}" does not exist. Available tools: ${Array.from(this.tools.keys()).join(', ')}`;
        } else {
          try {
            observationContent = await tool.execute(params);
          } catch (error) {
            observationContent = `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`;
          }
        }

        const observationStep: AgentStep = {
          type: 'observation',
          content: observationContent,
        };
        steps.push(observationStep);
        onStep?.(observationStep);

        // Append tool result to conversation history
        messages.push({
          role: 'user',
          content: `<observation>\n${observationContent}\n</observation>`,
        });

        continue;
      }

      // Model gave neither final_answer nor action — force exit
      const fallbackAnswer = assistantText.trim();
      const fallbackStep: AgentStep = {
        type: 'final_answer',
        content: fallbackAnswer || 'Task complete, but no explicit answer.',
      };
      steps.push(fallbackStep);
      onStep?.(fallbackStep);
      return { answer: fallbackAnswer, output: fallbackAnswer, steps };
    }

      // Max steps reached
    const timeoutAnswer =
      'Max step limit reached. Here is the progress so far:\n\n' +
      steps
        .filter((s) => s.type === 'observation')
        .map((s) => s.content)
        .join('\n\n');

    return {
      answer: timeoutAnswer,
      output: timeoutAnswer,
      stopped: 'maxSteps',
      steps,
    };
  }
}
