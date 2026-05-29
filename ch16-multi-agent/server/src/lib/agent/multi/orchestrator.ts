// #book ch16-orchestrator
// ch16-multi-agent/server/src/lib/agent/multi/orchestrator.ts
import { callLLM } from '../../llm.js';
import { ReActAgent, type Tool } from '../react-agent.js';
import { getToolsForRole } from '../tools/index.js';
import type { OrchestratorPlan, SubTask, SubTaskResult } from './types.js';

const ORCHESTRATOR_SYSTEM = `
You are a task orchestration expert. Your responsibilities are:
1. Understand the user's complex goal
2. Decompose the goal into parallelizable subtasks
3. Specify tool requirements and dependencies for each subtask
4. Synthesize all subtask results into a final answer

Decomposition principles:
- Independent tasks should run in parallel
- Dependent tasks run sequentially
- Each subtask must be concrete enough for a single Agent to complete independently
- Decompose into at most 6 subtasks
`.trim();

export class Orchestrator {
  private onProgress?: ((event: OrchestratorEvent) => void) | undefined;

  constructor(
    options: {
      onProgress?: ((event: OrchestratorEvent) => void) | undefined;
    } = {},
  ) {
    this.onProgress = options.onProgress;
  }

  private emit(event: OrchestratorEvent) {
    this.onProgress?.(event);
  }

  /**
   * Phase 1: Decompose the task
   */
  async decompose(goal: string): Promise<OrchestratorPlan> {
    this.emit({ type: 'planning', message: 'Analyzing goal and forming a plan...' });

    const { text } = await callLLM(
      [
        {
          role: 'user',
          content: `Decompose the following goal into subtasks and output JSON:

Goal: ${goal}

Output format:
{
  "goal": "goal description",
  "tasks": [
    {
      "id": "task_1",
      "title": "subtask title",
      "description": "detailed description, enough for another AI to complete independently",
      "toolSet": "browser|file|code|rag|general",
      "dependsOn": [],
      "priority": "high|medium|low",
      "timeoutMs": 60000
    }
  ],
  "estimatedParallelGroups": [["task_1", "task_2"], ["task_3"]]
}

Output JSON only.`,
        },
      ],
      { system: ORCHESTRATOR_SYSTEM, temperature: 0 },
    );

    try {
      const plan = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim());
      this.emit({
        type: 'plan_ready',
        message: `Plan ready: ${plan.tasks.length} subtasks`,
        plan,
      });
      return plan;
    } catch {
      throw new Error('Task decomposition failed: unable to parse plan');
    }
  }

  /**
   * Phase 2: Execute subtasks in parallel
   */
  async executeParallel(
    plan: OrchestratorPlan,
    maxConcurrency = 3,
  ): Promise<Map<string, SubTaskResult>> {
    const results = new Map<string, SubTaskResult>();
    const completed = new Set<string>();
    const failed = new Set<string>();

    // Execute by parallel group
    for (const group of plan.estimatedParallelGroups) {
      // Filter out tasks whose dependencies are not yet satisfied
      const executable = group.filter((taskId) => {
        const task = plan.tasks.find((t) => t.id === taskId);
        if (!task) return false;
        // Check that all dependencies have completed successfully
        return (task.dependsOn ?? []).every(
          (dep) => completed.has(dep) && !failed.has(dep),
        );
      });

      if (executable.length === 0) continue;

      this.emit({
        type: 'group_start',
        message: `Running ${executable.length} tasks in parallel: ${executable.join(', ')}`,
      });

      // Concurrent execution with concurrency limit
      const batchResults = await this.executeBatch(
        executable.map((id) => plan.tasks.find((t) => t.id === id)!),
        results,
        maxConcurrency,
      );

      for (const [id, result] of batchResults) {
        results.set(id, result);
        if (result.status === 'success') {
          completed.add(id);
        } else {
          failed.add(id);
        }
      }
    }

    return results;
  }

  private async executeBatch(
    tasks: SubTask[],
    previousResults: Map<string, SubTaskResult>,
    maxConcurrency: number,
  ): Promise<Map<string, SubTaskResult>> {
    const results = new Map<string, SubTaskResult>();
    const queue = [...tasks];
    const active: Promise<void>[] = [];

    const runTask = async (task: SubTask) => {
      this.emit({
        type: 'task_start',
        message: `Starting: ${task.title}`,
        taskId: task.id,
      });
      const result = await this.executeTask(task, previousResults);
      results.set(task.id, result);
      this.emit({
        type: 'task_done',
        message: `Done: ${task.title} (${result.status})`,
        taskId: task.id,
        result,
      });
    };

    // Concurrency control
    for (const task of queue) {
      const promise = runTask(task).catch((err) => {
        results.set(task.id, {
          taskId: task.id,
          status: 'failed',
          output: `Execution error: ${err instanceof Error ? err.message : String(err)}`,
          durationMs: 0,
        });
      });
      active.push(promise);

      if (active.length >= maxConcurrency) {
        // Wait for the fastest to finish, then remove it from active
        await Promise.race(active);
        // Promise.race doesn't tell us which one finished, but an already-settled Promise
        // resolves immediately on re-await — use Promise.race + filter to clean up
        const settled = await Promise.race(
          active.map((p, i) =>
            p.then(
              () => i,
              () => i,
            ),
          ),
        );
        active.splice(settled, 1);
      }
    }

    await Promise.allSettled(active);
    return results;
  }

  private async executeTask(
    task: SubTask,
    previousResults: Map<string, SubTaskResult>,
  ): Promise<SubTaskResult> {
    const start = Date.now();

    // Build context from upstream task results
    const context = (task.dependsOn ?? [])
      .map((depId) => {
        const dep = previousResults.get(depId);
        return dep ? `[${depId}] ${dep.output.slice(0, 1000)}` : '';
      })
      .filter(Boolean)
      .join('\n\n');

    const taskPrompt = context
      ? `Background (from upstream tasks):\n${context}\n\nCurrent task: ${task.description}`
      : task.description;

    // Select tools based on toolset
    const tools = this.getToolsForTaskType(task.toolSet);

    const agent = new ReActAgent({
      tools,
      maxSteps: 8,
      maxTokens: 2048,
    });

    try {
      // Execute with timeout
      const timeout = task.timeoutMs ?? 120_000;
      const result = await Promise.race([
        agent.run(taskPrompt),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('TIMEOUT')), timeout),
        ),
      ]);

      return {
        taskId: task.id,
        status: result.stopped === 'error' ? 'failed' : 'success',
        output: result.answer,
        durationMs: Date.now() - start,
      };
    } catch (error) {
      const isTimeout = error instanceof Error && error.message === 'TIMEOUT';
      return {
        taskId: task.id,
        status: isTimeout ? 'timeout' : 'failed',
        output: isTimeout
          ? `Task timed out (${task.timeoutMs ?? 120_000}ms)`
          : `Execution failed: ${error instanceof Error ? error.message : String(error)}`,
        durationMs: Date.now() - start,
      };
    }
  }

  private getToolsForTaskType(toolSet: SubTask['toolSet']): Tool[] {
    switch (toolSet) {
      case 'browser':
        return getToolsForRole('viewer').filter(
          (t) => t.name.startsWith('fetch') || t.name.startsWith('take'),
        );
      case 'file':
        return getToolsForRole('editor').filter((t) =>
          [
            'read_file',
            'write_file',
            'list_directory',
            'search_in_files',
          ].includes(t.name),
        );
      case 'code':
        return getToolsForRole('editor').filter((t) =>
          ['run_node_code', 'read_file', 'write_file'].includes(t.name),
        );
      default:
        return getToolsForRole('viewer');
    }
  }

  /**
   * Phase 3: Synthesize results
   */
  async synthesize(
    goal: string,
    plan: OrchestratorPlan,
    results: Map<string, SubTaskResult>,
  ): Promise<string> {
    this.emit({ type: 'synthesizing', message: 'Synthesizing all results...' });

    const taskSummaries = plan.tasks
      .map((task) => {
        const result = results.get(task.id);
        return `[${task.title}]\nStatus: ${result?.status ?? 'skipped'}\n${result?.output ?? 'No output'}`;
      })
      .join('\n\n---\n\n');

    const { text } = await callLLM(
      [
        {
          role: 'user',
          content: `Based on all subtask results, answer the original goal.

Original goal: ${goal}

Subtask results:
${taskSummaries}

Provide a complete, well-structured final answer. If some subtasks failed, explain the impact and provide a partial answer where possible.`,
        },
      ],
      { temperature: 0.5, maxTokens: 3000 },
    );

    return text;
  }

  /**
   * Full run: decompose → execute → synthesize
   */
  async run(goal: string): Promise<{
    answer: string;
    plan: OrchestratorPlan;
    results: Map<string, SubTaskResult>;
  }> {
    const plan = await this.decompose(goal);
    const results = await this.executeParallel(plan);
    const answer = await this.synthesize(goal, plan, results);

    this.emit({ type: 'done', message: 'Task complete' });

    return { answer, plan, results };
  }
}

export type OrchestratorEvent =
  | { type: 'planning'; message: string }
  | { type: 'plan_ready'; message: string; plan: OrchestratorPlan }
  | { type: 'group_start'; message: string }
  | { type: 'task_start'; message: string; taskId: string }
  | {
      type: 'task_done';
      message: string;
      taskId: string;
      result: SubTaskResult;
    }
  | { type: 'synthesizing'; message: string }
  | { type: 'done'; message: string };
// #endbook
