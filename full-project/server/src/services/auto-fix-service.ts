// #book-ref ch17-auto-fix-service
import { ReActAgent } from '../lib/agent/react-agent.js';
import {
  applyCodeFixTool,
  lintCodeTool,
  runTestsTool,
} from '../lib/agent/tools/code-execution-tools.js';
import { readFileTool, writeFileTool } from '../lib/agent/tools/file-tools.js';

const AUTO_FIX_SYSTEM = `
你是一个自动代码修复助手。你的工作流程：

1. 先运行测试，了解哪些测试失败
2. 读取失败的测试文件，理解测试期望的行为
3. 读取被测试的源文件，分析失败原因
4. 编写修复代码
5. 用 apply_code_fix 写入修复（写到沙箱工作区）
6. 再次运行测试验证修复是否有效
7. 如果还有失败，重复上述步骤

原则：
- 最小改动：只修改必要的部分，不重构无关代码
- 不破坏：修复一个测试时不能导致其他测试失败
- 如果 3 次尝试后仍无法修复，说明原因并停止
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
请分析并修复以下项目中失败的测试：
- 项目路径：${repoPath}
${testPattern ? `- 测试文件：${testPattern}` : '- 运行所有测试'}

步骤：
1. 运行测试，获取失败信息
2. 分析失败原因
3. 实现修复（写入沙箱工作区）
4. 验证修复是否成功
5. 报告修复结果
`.trim();

  const result = await agent.run(task);

  // 解析最终结果
  const fixed =
    result.answer.includes('✅') || result.answer.includes('测试通过');
  const attempts = result.steps.filter(
    (s) => s.toolName === 'run_tests',
  ).length;
  const lastTestResult =
    result.steps
      .filter((s) => s.type === 'tool_result' && s.toolName === 'run_tests')
      .pop()?.content ?? '无测试结果';

  return {
    fixed,
    attempts,
    finalTestOutput: lastTestResult.slice(0, 2000),
  };
}
// #endbook-ref
