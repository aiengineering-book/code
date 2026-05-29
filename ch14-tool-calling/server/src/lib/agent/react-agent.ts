// packages/server/src/lib/agent/react-agent.ts
// Chapter 13: ReAct Agent (text-parsing version)
// Chapter 14 upgrade uses Function Calling; see react-agent-v2.ts

import { DEFAULT_MODEL, openai } from '../openai.js';

export interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>; // JSON Schema for OpenAI Function Calling
  execute: (params: Record<string, unknown>) => Promise<string>;
}

export interface AgentStep {
  type: 'thought' | 'action' | 'observation' | 'final_answer' | 'tool_result';
  content: string;
  toolName?: string;
  toolParams?: Record<string, unknown>;
  toolResult?: unknown;
}

export interface AgentOptions {
  maxSteps?: number;
  verbose?: boolean;
  onStep?: (step: AgentStep) => void;
}

export class ReActAgent {
  private tools: Map<string, Tool>;

  constructor(tools: Tool[]) {
    this.tools = new Map(tools.map((t) => [t.name, t]));
  }

  private buildSystemPrompt(maxSteps: number): string {
    const toolDescriptions = Array.from(this.tools.values())
      .map(
        (t) =>
          `Tool name: ${t.name}\nDescription: ${t.description}\nParameters: ${JSON.stringify(t.inputSchema, null, 2)}`,
      )
      .join('\n\n---\n\n');

    return `
  You are an AI assistant that can use tools to solve problems.

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
  4. Execute at most ${maxSteps} steps; if exceeded, give your best current answer
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
        action = JSON.parse(actionText) as {
          tool: string;
          params: Record<string, unknown>;
        };
      } catch {
        const toolMatch = actionText.match(/"tool"\s*:\s*"([^"]+)"/);
        if (toolMatch?.[1]) {
          action = { tool: toolMatch[1], params: {} };
        }
      }
    }

    return { thought, action, finalAnswer };
  }

  async run(
    userMessage: string,
    options: AgentOptions = {},
  ): Promise<{ answer: string; steps: AgentStep[] }> {
    const { maxSteps = 10, verbose = false, onStep } = options;
    const steps: AgentStep[] = [];

    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
      { role: 'user', content: userMessage },
    ];

    const systemPrompt = this.buildSystemPrompt(maxSteps);

    for (let step = 0; step < maxSteps; step++) {
      const response = await openai.chat.completions.create({
        model: DEFAULT_MODEL,
        max_completion_tokens: 2048,
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
      });

      const assistantText = response.choices[0]?.message?.content ?? '';
      messages.push({ role: 'assistant', content: assistantText });

      if (verbose) console.log(`\n[Step ${step + 1}]\n${assistantText}`);

      const parsed = this.parseOutput(assistantText);

      if (parsed.thought) {
        const thoughtStep: AgentStep = {
          type: 'thought',
          content: parsed.thought,
        };
        steps.push(thoughtStep);
        onStep?.(thoughtStep);
      }

      if (parsed.finalAnswer) {
        const finalStep: AgentStep = {
          type: 'final_answer',
          content: parsed.finalAnswer,
        };
        steps.push(finalStep);
        onStep?.(finalStep);
        return { answer: parsed.finalAnswer, steps };
      }

      if (parsed.action) {
        const { tool: toolName, params } = parsed.action;
        const tool = this.tools.get(toolName);

        const actionStep: AgentStep = {
          type: 'action',
          content: `Calling tool: ${toolName}`,
          toolName,
          toolParams: params,
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
          toolResult: observationContent,
        };
        steps.push(observationStep);
        onStep?.(observationStep);

        messages.push({
          role: 'user',
          content: `<observation>\n${observationContent}\n</observation>`,
        });

        continue;
      }

      const fallbackAnswer = assistantText.trim();
      const fallbackStep: AgentStep = {
        type: 'final_answer',
      content: fallbackAnswer || 'Task complete, but no explicit answer.',
      };
      steps.push(fallbackStep);
      onStep?.(fallbackStep);
      return { answer: fallbackAnswer, steps };
    }

    const timeoutAnswer =
      'Max step limit reached. Here is the progress so far:\n\n' +
      steps
        .filter((s) => s.type === 'observation')
        .map((s) => s.content)
        .join('\n\n');

    return { answer: timeoutAnswer, steps };
  }
}
