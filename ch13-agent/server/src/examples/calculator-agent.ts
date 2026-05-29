// packages/server/src/examples/calculator-agent.ts
// #book ch13-calculator-agent

// ch13-agent/server/src/examples/calculator-agent.ts
import type { Tool } from '../lib/agent/react-agent.js';
import { ReActAgent } from '../lib/agent/react-agent.js';

const mathTools: Tool[] = [
  {
    name: 'add',
    description: '两数相加',
    parameters: {
      type: 'object',
      properties: {
        a: { type: 'number' },
        b: { type: 'number' },
      },
      required: ['a', 'b'],
    },
    execute: async ({ a, b }) => ({ result: (a as number) + (b as number) }),
  },
  {
    name: 'multiply',
    description: '两数相乘',
    parameters: {
      type: 'object',
      properties: {
        a: { type: 'number' },
        b: { type: 'number' },
      },
      required: ['a', 'b'],
    },
    execute: async ({ a, b }) => ({ result: (a as number) * (b as number) }),
  },
  {
    name: 'sqrt',
    description: '计算平方根',
    parameters: {
      type: 'object',
      properties: {
        n: { type: 'number' },
      },
      required: ['n'],
    },
    execute: async ({ n }) => ({ result: Math.sqrt(n as number) }),
  },
];

async function main() {
  const agent = new ReActAgent(mathTools);

  const { answer, steps } = await agent.run(
    '计算 (3 + 5) * 7 的结果，然后求它的平方根，最后告诉我结果是多少',
    {
      verbose: true,
      onStep: (step) => {
        if (step.type === 'action') {
          console.log(`🔧 调用工具：${step.toolName}`);
        } else if (step.type === 'observation') {
          console.log(`👁️  观察结果：${step.content}`);
        }
      },
    },
  );

  console.log('\n=== 最终答案 ===');
  console.log(answer);
  console.log(`\n共执行 ${steps.length} 步`);
}

main();
// #endbook
