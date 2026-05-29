// packages/server/src/lib/agent/plan-execute-agent.ts
// #book ch13-plan-execute

// ch13-agent/server/src/lib/agent/plan-execute-agent.ts
import { z } from 'zod';
import { callLLM } from '../llm.js';
import { structuredOutput } from '../structured-output.js';
import type { Tool } from './react-agent.js';

const PlanSchema = z.object({
  goal: z.string().describe('任务的最终目标'),
  steps: z.array(
    z.object({
      id: z.string(),
      description: z.string().describe('这一步要做什么'),
      tool: z.string().describe('使用哪个工具'),
      params: z.record(z.unknown()).describe('工具参数'),
      dependsOn: z.array(z.string()).default([]).describe('依赖的步骤 ID'),
    }),
  ),
});

type Plan = z.infer<typeof PlanSchema>;

export class PlanAndExecuteAgent {
  private tools: Map<string, Tool>;

  constructor(tools: Tool[]) {
    this.tools = new Map(tools.map((t) => [t.name, t]));
  }

  /**
   * 第一阶段：生成计划
   */
  private async plan(task: string): Promise<Plan> {
    const toolList = Array.from(this.tools.values())
      .map((t) => `- ${t.name}: ${t.description}`)
      .join('\n');

    return structuredOutput(
      PlanSchema,
      `
任务：${task}

可用工具：
${toolList}

请为完成这个任务制定详细的执行计划。
计划中的每个步骤都应该调用一个具体的工具。
如果某些步骤可以并行执行（不相互依赖），请在 dependsOn 中留空。
`.trim(),
      '你是一个任务规划专家，擅长把复杂任务分解为可执行的步骤序列。',
    );
  }

  /**
   * 第二阶段：按计划执行（支持并行）
   */
  private async execute(
    plan: Plan,
    onStepComplete?: (stepId: string, result: unknown) => void,
  ): Promise<Map<string, unknown>> {
    const results = new Map<string, unknown>();
    const pending = new Map(plan.steps.map((s) => [s.id, s]));

    while (pending.size > 0) {
      // 找出所有依赖已满足的步骤（可以并行执行）
      const ready = Array.from(pending.values()).filter((step) =>
        step.dependsOn.every((dep) => results.has(dep)),
      );

      if (ready.length === 0) {
        throw new Error('计划中存在循环依赖，无法继续执行');
      }

      // 并行执行所有就绪的步骤
      await Promise.all(
        ready.map(async (step) => {
          const tool = this.tools.get(step.tool);

          if (!tool) {
            results.set(step.id, `错误：工具 "${step.tool}" 不存在`);
          } else {
            try {
              // 将前置步骤的结果注入参数（支持 {{stepId.result}} 语法）
              const resolvedParams = this.resolveParams(step.params, results);
              const result = await tool.execute(resolvedParams);
              results.set(step.id, result);
              onStepComplete?.(step.id, result);
            } catch (error) {
              results.set(
                step.id,
                `执行失败：${error instanceof Error ? error.message : String(error)}`,
              );
            }
          }

          pending.delete(step.id);
        }),
      );
    }

    return results;
  }

  /**
   * 解析参数中的步骤引用（如 {{step1}} 替换为步骤1的结果）
   */
  private resolveParams(
    params: Record<string, unknown>,
    results: Map<string, unknown>,
  ): Record<string, unknown> {
    const resolved: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string') {
        resolved[key] = value.replace(/\{\{(\w+)\}\}/g, (_, stepId) => {
          const result = results.get(stepId);
          return result ? JSON.stringify(result) : `{{${stepId}}}`;
        });
      } else {
        resolved[key] = value;
      }
    }

    return resolved;
  }

  /**
   * 第三阶段：综合结果生成最终答案
   */
  private async synthesize(
    task: string,
    plan: Plan,
    results: Map<string, unknown>,
  ): Promise<string> {
    const resultSummary = plan.steps
      .map(
        (s) =>
          `步骤 ${s.id}（${s.description}）的结果：\n${JSON.stringify(results.get(s.id), null, 2)}`,
      )
      .join('\n\n');

    const { text } = await callLLM(
      [
        {
          role: 'user',
          content: `
原始任务：${task}

执行结果：
${resultSummary}

请基于以上执行结果，给出完整、清晰的最终答案。
`.trim(),
        },
      ],
      { temperature: 0.5 },
    );

    return text;
  }

  async run(
    task: string,
    options: {
      onPlanReady?: (plan: Plan) => void;
      onStepComplete?: (stepId: string, result: unknown) => void;
    } = {},
  ): Promise<{ answer: string; plan: Plan; results: Map<string, unknown> }> {
    // 1. 规划
    const plan = await this.plan(task);
    options.onPlanReady?.(plan);

    // 2. 执行
    const results = await this.execute(plan, options.onStepComplete);

    // 3. 综合
    const answer = await this.synthesize(task, plan, results);

    return { answer, plan, results };
  }
}
// #endbook
