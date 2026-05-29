// #book ch17-code-review-service

// ch17-coding-agent/server/src/services/code-review-service.ts
import { z } from 'zod';
import { ReActAgent } from '../lib/agent/react-agent.js';
import {
  lintCodeTool,
  runTestsTool,
} from '../lib/agent/tools/code-execution-tools.js';
import {
  listDirectoryTool,
  readFileTool,
  searchInFilesTool,
} from '../lib/agent/tools/file-tools.js';
import { gitDiffTool, gitLogTool } from '../lib/agent/tools/git-tools.js';
import { runNodeCodeTool } from '../lib/agent/tools/shell-tools.js';
import { structuredOutputWithFeedback } from '../lib/structured-output.js';

// 审查报告的结构化 Schema
const CodeReviewSchema = z.object({
  summary: z.string().describe('一句话总结本次代码变更'),
  overallScore: z.number().int().min(1).max(10).describe('代码质量综合评分'),
  issues: z
    .array(
      z.object({
        severity: z.enum(['critical', 'major', 'minor', 'suggestion']),
        category: z.enum([
          'bug',
          'security',
          'performance',
          'style',
          'maintainability',
        ]),
        file: z.string(),
        line: z.number().nullable(),
        description: z.string(),
        suggestion: z.string(),
        fixedCode: z.string().nullable(),
      }),
    )
    .describe('发现的问题列表'),
  positives: z.array(z.string()).describe('代码做得好的地方'),
  testResults: z
    .object({
      passed: z.number(),
      failed: z.number(),
      summary: z.string(),
    })
    .nullable()
    .describe('测试运行结果'),
  approved: z.boolean().describe('是否建议批准合并'),
});

type CodeReview = z.infer<typeof CodeReviewSchema>;

export interface ReviewRequest {
  repoPath: string; // 仓库路径
  targetBranch?: string; // 目标分支（默认 main）
  sourceBranch?: string; // 源分支（默认当前分支）
  focusAreas?: string[]; // 重点关注领域
}

const REVIEW_SYSTEM_PROMPT = `
你是一位资深 TypeScript 全栈工程师，专注于代码审查。

审查重点：
1. 类型安全：TypeScript 类型是否正确，是否有 any 滥用
2. 安全漏洞：SQL 注入、XSS、未验证的用户输入
3. 性能问题：不必要的 N+1 查询、内存泄漏、阻塞操作
4. 错误处理：是否正确处理了边界情况和异常
5. 代码可维护性：命名清晰、职责单一、是否有重复代码

审查流程：
1. 先用 git_diff 了解变更概况
2. 用 read_file 深入阅读改动的文件
3. 用 lint_code 检查代码规范
4. 用 run_tests 运行测试确认无回归
5. 综合以上信息给出结构化的审查报告
`.trim();

export class CodeReviewService {
  async review(
    request: ReviewRequest,
    onStep?: (step: string) => void,
  ): Promise<CodeReview> {
    const {
      repoPath,
      targetBranch = 'main',
      sourceBranch = 'HEAD',
      focusAreas = [],
    } = request;

    const tools = [
      readFileTool,
      listDirectoryTool,
      searchInFilesTool,
      gitDiffTool,
      gitLogTool,
      runTestsTool,
      lintCodeTool,
      runNodeCodeTool,
    ];

    // 构建任务描述
    const focusText =
      focusAreas.length > 0 ? `\n特别关注：${focusAreas.join('、')}` : '';

    const task = `
对以下代码变更进行全面审查：
- 仓库路径：${repoPath}
- 对比分支：${targetBranch}...${sourceBranch}
${focusText}

请按照以下步骤执行审查：
1. 用 git_diff 查看变更概况（与 ${targetBranch} 分支对比）
2. 阅读每个变更文件的完整内容
3. 对关键文件运行 lint_code 检查
4. 运行 run_tests 查看测试结果
5. 综合所有信息，准备详细的审查报告

最终以 JSON 格式输出审查结果，严格遵循以下结构：
{
  "summary": "一句话总结",
  "overallScore": 1-10 的整数,
  "issues": [
    {
      "severity": "critical" | "major" | "minor" | "suggestion",
      "category": "bug" | "security" | "performance" | "style" | "maintainability",
      "file": "文件路径",
      "line": 行号或null,
      "description": "问题描述",
      "suggestion": "修改建议",
      "fixedCode": "修复后的代码片段或null"
    }
  ],
  "positives": ["优点1", "优点2"],
  "testResults": { "passed": 数字, "failed": 数字, "summary": "测试结果描述" } 或 null,
  "approved": true/false
}
`.trim();

    const agent = new ReActAgent({
      tools,
      systemPrompt: REVIEW_SYSTEM_PROMPT,
      maxSteps: 15,
      maxTokens: 4096,
      onStep: (step) => {
        onStep?.(`[${step.type}] ${step.content.slice(0, 100)}`);
      },
    });

    const result = await agent.run(task);

    // 从 Agent 输出中提取结构化数据
    // Agent 的 answer 中应该包含 JSON 格式的审查报告
    try {
      const jsonMatch =
        result.answer.match(/```json\n?([\s\S]*?)\n?```/) ??
        result.answer.match(/\{[\s\S]*"summary"[\s\S]*\}/);

      const jsonStr = jsonMatch
        ? (jsonMatch[1] ?? jsonMatch[0])
        : result.answer;
      const parsed = JSON.parse(jsonStr.trim());
      return CodeReviewSchema.parse(parsed);
    } catch {
      // 如果解析失败，让 LLM 重新格式化
      return structuredOutputWithFeedback(
        CodeReviewSchema,
        `将以下审查内容转换为要求的 JSON 格式：\n\n${result.answer}`,
        '你是一个数据格式转换助手，精确转换不添加内容。',
      );
    }
  }
}

export const codeReviewService = new CodeReviewService();
// #endbook
