// packages/server/src/lib/agent/tools/tool-tester.ts
// #book ch14-tool-tester

// ch14-tool-calling/server/src/lib/agent/tools/tool-tester.ts
import { DEFAULT_MODEL, openai } from '../../openai.js';
import type { Tool } from '../react-agent.js';

interface ToolTestCase {
  description: string; // 测试描述
  userMessage: string; // 触发工具调用的用户消息
  expectedTool: string; // 期望调用的工具名
  expectedParams?: Record<string, unknown>; // 期望的参数（可选）
}

/**
 * 验证模型是否能正确识别何时调用工具以及使用什么参数
 */
export async function testToolSelection(
  tools: Tool[],
  testCases: ToolTestCase[],
): Promise<{ passed: number; failed: number; details: string[] }> {
  let passed = 0;
  let failed = 0;
  const details: string[] = [];

  for (const tc of testCases) {
    const response = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      max_completion_tokens: 512,
      tools: tools.map((t) => ({
        type: 'function' as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.inputSchema,
        },
      })),
      messages: [{ role: 'user', content: tc.userMessage }],
    });

    const allCalls = response.choices[0]?.message.tool_calls ?? [];
    // 只取 function 类型的工具调用
    const firstCall = allCalls.find((tc) => tc.type === 'function');

    if (!firstCall || firstCall.type !== 'function') {
      failed++;
      details.push(`❌ ${tc.description}：模型未调用任何工具`);
      continue;
    }

    if (firstCall.function.name !== tc.expectedTool) {
      failed++;
      details.push(
        `❌ ${tc.description}：期望调用 ${tc.expectedTool}，实际调用 ${firstCall.function.name}`,
      );
      continue;
    }

    passed++;
    details.push(`✅ ${tc.description}`);
  }

  return { passed, failed, details };
}
// #endbook
