// #book-ref ch17-auto-fix-service
// ch17-coding-agent/server/src/services/auto-fix-service.ts
import { ReActAgent } from '../lib/agent/react-agent.js';
import {
  applyCodeFixTool,
  lintCodeTool,
  runTestsTool,
} from '../lib/agent/tools/code-execution-tools.js';
import { readFileTool, writeFileTool } from '../lib/agent/tools/file-tools.js';

const AUTO_FIX_SYSTEM = `
You are an automated code fix assistant. Your workflow:

1. Run tests to find which ones are failing
2. Read the failing test files to understand the expected behavior
3. Read the source files being tested to analyze the failure reason
4. Write the fix code
5. Use apply_code_fix to write the fix (into the sandbox workspace)
6. Run tests again to verify the fix works
7. If there are still failures, repeat the above steps

Principles:
- Minimal changes: only modify what is necessary, do not refactor unrelated code
- No regressions: fixing one test must not cause other tests to fail
- If unable to fix after 3 attempts, explain why and stop
`.trim();

export async function autoFixTests(
  repoPath: string,
  testPattern?: string,
  onProgress?: (message: string) => void,
): Promise<{
  fixed: boolean;
  attempts: number;
  finalTestOutput: string;
}> {
  const agent = new ReActAgent({
    tools: [
      readFileTool,
      writeFileTool,
      runTestsTool,
      lintCodeTool,
      applyCodeFixTool,
    ],
    systemPrompt: AUTO_FIX_SYSTEM,
    maxSteps: 20,
    onStep: (step) => {
      if (step.type !== 'tool_result') {
        onProgress?.(`[${step.type}] ${step.content.slice(0, 80)}`);
      }
    },
  });

  const task = `
Analyze and fix the failing tests in the following project:
- Project path: ${repoPath}
${testPattern ? `- Test files: ${testPattern}` : '- Run all tests'}

Steps:
1. Run tests to get failure information
2. Analyze the cause of failures
3. Implement fixes (written to the sandbox workspace)
4. Verify that the fix succeeds
5. Report the fix result
`.trim();

  const result = await agent.run(task);

  // Parse the final result
  const fixed =
    result.answer.includes('✅') || result.answer.toLowerCase().includes('tests pass');
  const attempts = result.steps.filter(
    (s) => s.toolName === 'run_tests',
  ).length;
  const lastTestResult =
    result.steps
      .filter((s) => s.type === 'tool_result' && s.toolName === 'run_tests')
      .pop()?.content ?? 'No test results';

  return {
    fixed,
    attempts,
    finalTestOutput: lastTestResult.slice(0, 2000),
  };
}
