// #book ch16-multi-types
// ch16-multi-agent/server/src/lib/agent/multi/types.ts

export interface SubTask {
  id: string;
  title: string; // Subtask title
  description: string; // Detailed description
  toolSet: 'browser' | 'file' | 'code' | 'rag' | 'general';
  dependsOn?: string[]; // IDs of tasks this depends on
  priority: 'high' | 'medium' | 'low';
  timeoutMs?: number; // Timeout duration
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
  estimatedParallelGroups: string[][]; // Task groups that can run in parallel
}
// #endbook
