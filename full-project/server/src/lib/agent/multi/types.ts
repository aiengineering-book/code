// #book-ref ch16-multi-types

export interface SubTask {
  id: string;
  title: string; // 子任务标题
  description: string; // 详细描述
  toolSet: 'browser' | 'file' | 'code' | 'rag' | 'general';
  dependsOn?: string[]; // 依赖的子任务 ID
  priority: 'high' | 'medium' | 'low';
  timeoutMs?: number; // 超时时间
}

export interface SubTaskResult {
  taskId: string;
  status: 'success' | 'failed' | 'timeout' | 'skipped';
  output: string;
  durationMs: number;
  tokensUsed?: number;
}

export interface OrchestratorPlan {
  goal: string;
  tasks: SubTask[];
  estimatedParallelGroups: string[][]; // 可以并行执行的任务分组
}
// #endbook-ref
