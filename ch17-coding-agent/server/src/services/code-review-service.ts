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

// Structured schema for the review report
const CodeReviewSchema = z.object({
  summary: z.string().describe('One-sentence summary of the code change'),
  overallScore: z
    .number()
    .int()
    .min(1)
    .max(10)
    .describe('Overall code quality score'),
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
    .describe('List of identified issues'),
  positives: z.array(z.string()).describe('Things the code does well'),
  testResults: z
    .object({
      passed: z.number(),
      failed: z.number(),
      summary: z.string(),
    })
    .nullable()
    .describe('Test run results'),
  approved: z.boolean().describe('Whether the change is recommended for merge'),
});

type CodeReview = z.infer<typeof CodeReviewSchema>;

export interface ReviewRequest {
  repoPath: string; // Repository path
  targetBranch?: string; // Target branch (default: main)
  sourceBranch?: string; // Source branch (default: current branch)
  focusAreas?: string[]; // Areas to focus on
}

const REVIEW_SYSTEM_PROMPT = `
You are a senior TypeScript fullstack engineer specializing in code review.

Review focus areas:
1. Type safety: are TypeScript types correct, is "any" overused
2. Security vulnerabilities: SQL injection, XSS, unvalidated user input
3. Performance issues: unnecessary N+1 queries, memory leaks, blocking operations
4. Error handling: are edge cases and exceptions handled correctly
5. Maintainability: clear naming, single responsibility, code duplication

Review process:
1. Use git_diff to understand the scope of changes
2. Use read_file to read changed files in detail
3. Use lint_code to check code style
4. Use run_tests to run tests and confirm no regressions
5. Synthesize all the above into a structured review report
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

    // Build task description
    const focusText =
      focusAreas.length > 0
        ? `\nFocus especially on: ${focusAreas.join(', ')}`
        : '';

    const task = `
Perform a comprehensive review of the following code change:
- Repository path: ${repoPath}
- Comparing: ${targetBranch}...${sourceBranch}
${focusText}

Follow these steps:
1. Use git_diff to see the change summary (compared to ${targetBranch})
2. Read the complete content of each changed file
3. Run lint_code on key files
4. Run run_tests to check test results
5. Synthesize all information and prepare a detailed review report

Output the review as JSON, strictly following this structure:
{
  "summary": "one-sentence summary",
  "overallScore": integer from 1 to 10,
  "issues": [
    {
      "severity": "critical" | "major" | "minor" | "suggestion",
      "category": "bug" | "security" | "performance" | "style" | "maintainability",
      "file": "file path",
      "line": line number or null,
      "description": "description of the issue",
      "suggestion": "suggested fix",
      "fixedCode": "fixed code snippet or null"
    }
  ],
  "positives": ["strength 1", "strength 2"],
  "testResults": { "passed": number, "failed": number, "summary": "test result description" } or null,
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

    // Extract structured data from Agent output
    // The Agent's answer should contain the review report in JSON format
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
      // If parsing fails, ask the LLM to reformat
      return structuredOutputWithFeedback(
        CodeReviewSchema,
        `Convert the following review content into the required JSON format:\n\n${result.answer}`,
        'You are a data format conversion assistant. Convert precisely without adding content.',
      );
    }
  }
}

export const codeReviewService = new CodeReviewService();
// #endbook
