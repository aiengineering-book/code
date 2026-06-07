// ch13-agent/server/src/lib/agent/react-agent.ts
// #book ch13-react-agent
// ch13-agent/server/src/lib/agent/react-agent.ts
import { DEFAULT_MODEL, openai } from '../openai.js';

export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
  execute: (params: Record<string, unknown>) => Promise<unknown>;
}

export interface AgentStep {
  type: 'thought' | 'action' | 'observation' | 'final_answer';
  content: string;
  toolName?: string;
  toolParams?: Record<string, unknown>;
  toolResult?: unknown;
}

export interface AgentOptions {
  maxSteps?: number; // Maximum steps before forced termination
  verbose?: boolean; // Whether to print per-step logs
  onStep?: (step: AgentStep) => void; // Step callback (for streaming display)
}

export class ReActAgent {
  private tools: Map<string, Tool>;

  constructor(tools: Tool[]) {
    this.tools = new Map(tools.map((t) => [t.name, t]));
  }

  /**
   * Build the tool descriptions injected into the system prompt
   */
  private buildSystemPrompt(): string {
    const toolDescriptions = Array.from(this.tools.values())
      .map(
        (t) =>
          `Tool: ${t.name}\nDescription: ${t.description}\nParameters: ${JSON.stringify(t.parameters, null, 2)}`,
      )
      .join('\n\n---\n\n');

    return `
You are an AI assistant that can use tools to solve problems.

# Available tools

${toolDescriptions}

# Workflow

On every response, output in this exact format:

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
I have enough information to answer this question
</thought>

<final_answer>
Final answer content
</final_answer>

# Important rules

1. Call only one tool per step
2. Carefully read the tool's return value before deciding the next step
3. If a tool errors, try different parameters or switch to another tool
4. Maximum {maxSteps} steps — after that, provide your best current answer
5. Never fabricate tool call results
`.trim();
  }

  /**
   * Parse model output to extract thought/action/final_answer
   */
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
        // JSON parse failed — try to extract tool name at minimum
        const toolMatch = actionText.match(/"tool"\s*:\s*"([^"]+)"/);
        if (toolMatch) {
          action = { tool: toolMatch[1]!, params: {} };
        }
      }
    }

    return { thought, action, finalAnswer };
  }

  /**
   * Run the ReAct loop
   */
  async run(
    userMessage: string,
    options: AgentOptions = {},
  ): Promise<{ answer: string; steps: AgentStep[] }> {
    const { maxSteps = 10, verbose = false, onStep } = options;
    const steps: AgentStep[] = [];

    // Conversation history (appended on each iteration)
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
      { role: 'user', content: userMessage },
    ];

    const systemPrompt = this.buildSystemPrompt().replace(
      '{maxSteps}',
      String(maxSteps),
    );

    for (let step = 0; step < maxSteps; step++) {
      // Call the LLM
      const response = await openai.chat.completions.create({
        model: DEFAULT_MODEL,
        max_completion_tokens: 2048,
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
      });

      const assistantText = response.choices[0]?.message?.content ?? '';

      // Add model response to conversation history
      messages.push({ role: 'assistant', content: assistantText });

      if (verbose) console.log(`\n[Step ${step + 1}]\n${assistantText}`);

      // Parse the output
      const parsed = this.parseOutput(assistantText);

      // Record the thought step
      if (parsed.thought) {
        const thoughtStep: AgentStep = {
          type: 'thought',
          content: parsed.thought,
        };
        steps.push(thoughtStep);
        onStep?.(thoughtStep);
      }

      // If final answer, end the loop
      if (parsed.finalAnswer) {
        const finalStep: AgentStep = {
          type: 'final_answer',
          content: parsed.finalAnswer,
        };
        steps.push(finalStep);
        onStep?.(finalStep);
        return { answer: parsed.finalAnswer, steps };
      }

      // If tool call, execute the tool
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
            const result = await tool.execute(params);
            observationContent =
              typeof result === 'string'
                ? result
                : JSON.stringify(result, null, 2);
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

        // Append tool result to conversation history
        messages.push({
          role: 'user',
          content: `<observation>\n${observationContent}\n</observation>`,
        });

        continue;
      }

      // Model produced neither final_answer nor action — terminate
      const fallbackAnswer = assistantText.trim();
      const fallbackStep: AgentStep = {
        type: 'final_answer',
        content:
          fallbackAnswer || 'Task complete, but no explicit answer was given.',
      };
      steps.push(fallbackStep);
      onStep?.(fallbackStep);
      return { answer: fallbackAnswer, steps };
    }

    // Maximum steps reached
    const timeoutAnswer =
      'Maximum step limit reached. Progress so far:\n\n' +
      steps
        .filter((s) => s.type === 'observation')
        .map((s) => s.content)
        .join('\n\n');

    return { answer: timeoutAnswer, steps };
  }
}
// #endbook
