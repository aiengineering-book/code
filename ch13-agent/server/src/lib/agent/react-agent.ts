// packages/server/src/lib/agent/react-agent.ts
// #book ch13-react-agent
import { DEFAULT_MODEL, openai } from '../openai.js';
// ch13-agent/server/src/lib/agent/react-agent.ts

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
  maxSteps?: number; // 最大步数（防止无限循环）
  verbose?: boolean; // 是否打印每步日志
  onStep?: (step: AgentStep) => void; // 步骤回调（用于流式展示）
}

export class ReActAgent {
  private tools: Map<string, Tool>;

  constructor(tools: Tool[]) {
    this.tools = new Map(tools.map((t) => [t.name, t]));
  }

  /**
   * 构建工具描述，注入到 System Prompt
   */
  private buildSystemPrompt(): string {
    const toolDescriptions = Array.from(this.tools.values())
      .map(
        (t) =>
          `工具名称：${t.name}\n描述：${t.description}\n参数：${JSON.stringify(t.parameters, null, 2)}`,
      )
      .join('\n\n---\n\n');

    return `
你是一个能够使用工具解决问题的 AI 助手。

# 可用工具

${toolDescriptions}

# 工作流程

每次回复时，你必须按照以下格式输出：

<thought>
分析当前情况，决定下一步行动
</thought>

<action>
{
  "tool": "工具名称",
  "params": { "参数名": "参数值" }
}
</action>

当你有足够信息可以回答用户时，输出：

<thought>
我已经有了足够的信息来回答这个问题
</thought>

<final_answer>
最终答案内容
</final_answer>

# 重要规则

1. 每次只调用一个工具
2. 仔细观察工具的返回结果，再决定下一步
3. 如果工具出错，尝试用不同的参数重试，或换其他工具
4. 最多执行 {maxSteps} 步，超过后必须给出当前最佳答案
5. 不要编造工具调用的结果
`.trim();
  }

  /**
   * 解析模型输出，提取 thought/action/final_answer
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
        // JSON 解析失败，尝试提取工具名
        const toolMatch = actionText.match(/"tool"\s*:\s*"([^"]+)"/);
        if (toolMatch) {
          action = { tool: toolMatch[1]!, params: {} };
        }
      }
    }

    return { thought, action, finalAnswer };
  }

  /**
   * 执行 ReAct 循环
   */
  async run(
    userMessage: string,
    options: AgentOptions = {},
  ): Promise<{ answer: string; steps: AgentStep[] }> {
    const { maxSteps = 10, verbose = false, onStep } = options;
    const steps: AgentStep[] = [];

    // 对话历史（每次循环追加）
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
      { role: 'user', content: userMessage },
    ];

    const systemPrompt = this.buildSystemPrompt().replace(
      '{maxSteps}',
      String(maxSteps),
    );

    for (let step = 0; step < maxSteps; step++) {
      // 调用 LLM
      const response = await openai.chat.completions.create({
        model: DEFAULT_MODEL,
        max_completion_tokens: 2048,
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
      });

      const assistantText = response.choices[0]?.message?.content ?? '';

      // 把模型回复加入对话历史
      messages.push({ role: 'assistant', content: assistantText });

      if (verbose) console.log(`\n[Step ${step + 1}]\n${assistantText}`);

      // 解析输出
      const parsed = this.parseOutput(assistantText);

      // 记录思考步骤
      if (parsed.thought) {
        const thoughtStep: AgentStep = {
          type: 'thought',
          content: parsed.thought,
        };
        steps.push(thoughtStep);
        onStep?.(thoughtStep);
      }

      // 如果是最终答案，结束循环
      if (parsed.finalAnswer) {
        const finalStep: AgentStep = {
          type: 'final_answer',
          content: parsed.finalAnswer,
        };
        steps.push(finalStep);
        onStep?.(finalStep);
        return { answer: parsed.finalAnswer, steps };
      }

      // 如果是工具调用，执行工具
      if (parsed.action) {
        const { tool: toolName, params } = parsed.action;
        const tool = this.tools.get(toolName);

        const actionStep: AgentStep = {
          type: 'action',
          content: `调用工具：${toolName}`,
          toolName,
          toolParams: params,
        };
        steps.push(actionStep);
        onStep?.(actionStep);

        let observationContent: string;

        if (!tool) {
          observationContent = `错误：工具 "${toolName}" 不存在。可用工具：${Array.from(this.tools.keys()).join(', ')}`;
        } else {
          try {
            const result = await tool.execute(params);
            observationContent =
              typeof result === 'string'
                ? result
                : JSON.stringify(result, null, 2);
          } catch (error) {
            observationContent = `工具执行失败：${error instanceof Error ? error.message : String(error)}`;
          }
        }

        const observationStep: AgentStep = {
          type: 'observation',
          content: observationContent,
          toolResult: observationContent,
        };
        steps.push(observationStep);
        onStep?.(observationStep);

        // 把工具结果追加到对话历史
        messages.push({
          role: 'user',
          content: `<observation>\n${observationContent}\n</observation>`,
        });

        continue;
      }

      // 模型既没有给 final_answer 也没有 action，强制结束
      const fallbackAnswer = assistantText.trim();
      const fallbackStep: AgentStep = {
        type: 'final_answer',
        content: fallbackAnswer || '任务完成，但没有明确的答案。',
      };
      steps.push(fallbackStep);
      onStep?.(fallbackStep);
      return { answer: fallbackAnswer, steps };
    }

    // 达到最大步数
    const timeoutAnswer =
      '已达到最大步数限制，以下是目前的进展：\n\n' +
      steps
        .filter((s) => s.type === 'observation')
        .map((s) => s.content)
        .join('\n\n');

    return { answer: timeoutAnswer, steps };
  }
}
// #endbook
