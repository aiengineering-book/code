// ch13-agent/server/src/examples/calculator-agent.ts
// #book ch13-calculator-agent
// ch13-agent/server/src/examples/calculator-agent.ts

import type { Tool } from '../lib/agent/react-agent.js';
import { ReActAgent } from '../lib/agent/react-agent.js';

const mathTools: Tool[] = [
  {
    name: 'add',
    description: 'Add two numbers',
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
    description: 'Multiply two numbers',
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
    description: 'Compute the square root',
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
    'Compute (3 + 5) * 7, then take the square root of the result, and tell me what it is',
    {
      verbose: true,
      onStep: (step) => {
        if (step.type === 'action') {
          console.log(`🔧 Calling tool: ${step.toolName}`);
        } else if (step.type === 'observation') {
          console.log(`👁️  Observation: ${step.content}`);
        }
      },
    },
  );

  console.log('\n=== Final Answer ===');
  console.log(answer);
  console.log(`\nCompleted in ${steps.length} steps`);
}

main();
// #endbook
