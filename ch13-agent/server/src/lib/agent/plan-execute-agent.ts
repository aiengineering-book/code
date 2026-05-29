// packages/server/src/lib/agent/plan-execute-agent.ts
// #book ch13-plan-execute
// ch13-agent/server/src/lib/agent/plan-execute-agent.ts

import { z } from 'zod';
import { callLLM } from '../llm.js';
import { structuredOutput } from '../structured-output.js';
import type { Tool } from './react-agent.js';

const PlanSchema = z.object({
  goal: z.string().describe('The final objective of the task'),
  steps: z.array(
    z.object({
      id: z.string(),
      description: z.string().describe('What this step does'),
      tool: z.string().describe('Which tool to use'),
      params: z.record(z.unknown()).describe('Tool parameters'),
      dependsOn: z.array(z.string()).default([]).describe('IDs of prerequisite steps'),
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
   * Phase 1: Generate the plan
   */
  private async plan(task: string): Promise<Plan> {
    const toolList = Array.from(this.tools.values())
      .map((t) => `- ${t.name}: ${t.description}`)
      .join('\n');

    return structuredOutput(
      PlanSchema,
      `
Task: ${task}

Available tools:
${toolList}

Create a detailed execution plan for this task.
Each step should call a specific tool.
Steps that don't depend on each other can have empty dependsOn lists (they can run in parallel).
`.trim(),
      'You are an expert task planner who specializes in breaking complex tasks into executable step sequences.',
    );
  }

  /**
   * Phase 2: Execute the plan (with parallelism support)
   */
  private async execute(
    plan: Plan,
    onStepComplete?: (stepId: string, result: unknown) => void,
  ): Promise<Map<string, unknown>> {
    const results = new Map<string, unknown>();
    const pending = new Map(plan.steps.map((s) => [s.id, s]));

    while (pending.size > 0) {
      // Find all steps whose dependencies are satisfied (can run in parallel)
      const ready = Array.from(pending.values()).filter((step) =>
        step.dependsOn.every((dep) => results.has(dep)),
      );

      if (ready.length === 0) {
        throw new Error('Circular dependency detected in plan — cannot continue');
      }

      // Execute all ready steps in parallel
      await Promise.all(
        ready.map(async (step) => {
          const tool = this.tools.get(step.tool);

          if (!tool) {
            results.set(step.id, `Error: tool "${step.tool}" does not exist`);
          } else {
            try {
              // Inject prior step results into parameters (supports {{stepId}} syntax)
              const resolvedParams = this.resolveParams(step.params, results);
              const result = await tool.execute(resolvedParams);
              results.set(step.id, result);
              onStepComplete?.(step.id, result);
            } catch (error) {
              results.set(
                step.id,
                `Execution failed: ${error instanceof Error ? error.message : String(error)}`,
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
   * Resolve step references in parameters (e.g., {{step1}} → step 1's result)
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
   * Phase 3: Synthesize results into a final answer
   */
  private async synthesize(
    task: string,
    plan: Plan,
    results: Map<string, unknown>,
  ): Promise<string> {
    const resultSummary = plan.steps
      .map(
        (s) =>
          `Step ${s.id} (${s.description}) result:\n${JSON.stringify(results.get(s.id), null, 2)}`,
      )
      .join('\n\n');

    const { text } = await callLLM(
      [
        {
          role: 'user',
          content: `
Original task: ${task}

Execution results:
${resultSummary}

Based on the above results, provide a complete and clear final answer.
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
    // 1. Plan
    const plan = await this.plan(task);
    options.onPlanReady?.(plan);

    // 2. Execute
    const results = await this.execute(plan, options.onStepComplete);

    // 3. Synthesize
    const answer = await this.synthesize(task, plan, results);

    return { answer, plan, results };
  }
}
// #endbook
