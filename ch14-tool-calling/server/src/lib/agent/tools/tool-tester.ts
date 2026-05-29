// packages/server/src/lib/agent/tools/tool-tester.ts
// #book ch14-tool-tester
// ch14-tool-calling/server/src/lib/agent/tools/tool-tester.ts

import { DEFAULT_MODEL, openai } from '../../openai.js';
import type { Tool } from '../react-agent.js';

interface ToolTestCase {
  description: string;         // What is this test checking
  userMessage: string;         // User message that should trigger a tool call
  expectedTool: string;        // Expected tool name
  expectedParams?: Record<string, unknown>; // Expected parameters (optional)
}

/**
 * Verify that the model correctly identifies when to call tools and with what parameters
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
    // Only handle function-type tool calls
    const firstCall = allCalls.find((tc) => tc.type === 'function');

    if (!firstCall || firstCall.type !== 'function') {
      failed++;
      details.push(`❌ ${tc.description}: model did not call any tool`);
      continue;
    }

    if (firstCall.function.name !== tc.expectedTool) {
      failed++;
      details.push(
        `❌ ${tc.description}: expected ${tc.expectedTool}, got ${firstCall.function.name}`,
      );
      continue;
    }

    passed++;
    details.push(`✅ ${tc.description}`);
  }

  return { passed, failed, details };
}
// #endbook
