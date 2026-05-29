// #book-ref ch16-orchestrator
import { callLLM } from '../../llm.js';
import { ReActAgent, type Tool } from '../react-agent.js';
import { getToolsForRole } from '../tools/index.js';
import type { OrchestratorPlan, SubTask, SubTaskResult } from './types.js';

const ORCHESTRATOR_SYSTEM = `
你是一个任务编排专家。你的职责是：
1. 理解用户的复杂目标
2. 将目标分解为可并行执行的子任务
3. 明确每个子任务的工具需求和依赖关系
4. 综合所有子任务的结果，生成最终答案

分解原则：
- 相互独立的任务应该并行执行
- 有依赖关系的任务按顺序执行
- 每个子任务要足够具体，单个 Agent 可以独立完成
- 最多分解为 6 个子任务
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
   * 阶段一：分解任务
   */
  async decompose(goal: string): Promise<OrchestratorPlan> {
    this.emit({ type: 'planning', message: '正在分析目标并制定计划...' });

    const { text } = await callLLM(
      [
        {
          role: 'user',
          content: `将以下目标分解为子任务，输出 JSON：

目标：${goal}

输出格式：
{
  "goal": "目标描述",
  "tasks": [
    {
      "id": "task_1",
      "title": "子任务标题",
      "description": "详细描述，足够让另一个 AI 独立完成",
      "toolSet": "browser|file|code|rag|general",
      "dependsOn": [],
      "priority": "high|medium|low",
      "timeoutMs": 60000
    }
  ],
  "estimatedParallelGroups": [["task_1", "task_2"], ["task_3"]]
}

只输出 JSON。`,
        },
      ],
      { system: ORCHESTRATOR_SYSTEM, temperature: 0 },
    );

    try {
      const plan = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim());
      this.emit({
        type: 'plan_ready',
        message: `计划制定完成：${plan.tasks.length} 个子任务`,
        plan,
      });
      return plan;
    } catch {
      throw new Error('任务分解失败：无法解析计划');
    }
  }

  /**
   * 阶段二：并行执行子任务
   */
  async executeParallel(
    plan: OrchestratorPlan,
    maxConcurrency = 3,
  ): Promise<Map<string, SubTaskResult>> {
    const results = new Map<string, SubTaskResult>();
    const completed = new Set<string>();
    const failed = new Set<string>();

    // 按并行分组执行
    for (const group of plan.estimatedParallelGroups) {
      // 过滤掉依赖未满足的任务
      const executable = group.filter((taskId) => {
        const task = plan.tasks.find((t) => t.id === taskId);
        if (!task) return false;
        // 检查所有依赖是否已完成
        return (task.dependsOn ?? []).every(
          (dep) => completed.has(dep) && !failed.has(dep),
        );
      });

      if (executable.length === 0) continue;

      this.emit({
        type: 'group_start',
        message: `并行执行 ${executable.length} 个任务：${executable.join(', ')}`,
      });

      // 并发执行（带并发限制）
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
        message: `开始：${task.title}`,
        taskId: task.id,
      });
      const result = await this.executeTask(task, previousResults);
      results.set(task.id, result);
      this.emit({
        type: 'task_done',
        message: `完成：${task.title}（${result.status}）`,
        taskId: task.id,
        result,
      });
    };

    // 并发控制
    for (const task of queue) {
      const promise = runTask(task).catch((err) => {
        results.set(task.id, {
          taskId: task.id,
          status: 'failed',
          output: `执行异常：${err instanceof Error ? err.message : String(err)}`,
          durationMs: 0,
        });
      });
      active.push(promise);

      if (active.length >= maxConcurrency) {
        // 等待最快完成的那个，然后把它从 active 中移除
        await Promise.race(active);
        // Promise.race 不会告诉我们谁完成了，但已完成的 Promise 再次 await 会立即返回
        // 用 Promise.race + filter 清理：把已 settled 的移出队列
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

    // 构建上下文（前置任务的结果）
    const context = (task.dependsOn ?? [])
      .map((depId) => {
        const dep = previousResults.get(depId);
        return dep ? `[${depId}] ${dep.output.slice(0, 1000)}` : '';
      })
      .filter(Boolean)
      .join('\n\n');

    const taskPrompt = context
      ? `背景信息（来自前置任务）：\n${context}\n\n当前任务：${task.description}`
      : task.description;

    // 根据工具集选择工具
    const tools = this.getToolsForTaskType(task.toolSet);

    const agent = new ReActAgent({
      tools,
      maxSteps: 8,
      maxTokens: 2048,
    });

    try {
      // 带超时的执行
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
          ? `任务超时（${task.timeoutMs ?? 120_000}ms）`
          : `执行失败：${error instanceof Error ? error.message : String(error)}`,
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
   * 阶段三：综合结果
   */
  async synthesize(
    goal: string,
    plan: OrchestratorPlan,
    results: Map<string, SubTaskResult>,
  ): Promise<string> {
    this.emit({ type: 'synthesizing', message: '正在综合所有结果...' });

    const taskSummaries = plan.tasks
      .map((task) => {
        const result = results.get(task.id);
        return `[${task.title}]\n状态：${result?.status ?? 'skipped'}\n${result?.output ?? '无结果'}`;
      })
      .join('\n\n---\n\n');

    const { text } = await callLLM(
      [
        {
          role: 'user',
          content: `根据所有子任务的执行结果，综合回答原始目标。

原始目标：${goal}

子任务结果：
${taskSummaries}

请给出完整、结构清晰的最终答案。如果某些子任务失败，说明影响并尽力给出部分答案。`,
        },
      ],
      { temperature: 0.5, maxTokens: 3000 },
    );

    return text;
  }

  /**
   * 完整运行：分解 → 执行 → 综合
   */
  async run(goal: string): Promise<{
    answer: string;
    plan: OrchestratorPlan;
    results: Map<string, SubTaskResult>;
  }> {
    const plan = await this.decompose(goal);
    const results = await this.executeParallel(plan);
    const answer = await this.synthesize(goal, plan, results);

    this.emit({ type: 'done', message: '任务完成' });

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
// #endbook-ref
