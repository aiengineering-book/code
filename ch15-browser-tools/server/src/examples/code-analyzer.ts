// #book ch15-code-analyzer
// ch15-browser-tools/server/src/examples/code-analyzer.ts
import 'dotenv/config';
import { ReActAgent } from '../lib/agent/react-agent.js';
import { getToolsForRole } from '../lib/agent/tools/index.js';

const agent = new ReActAgent({
  tools: getToolsForRole('viewer'),
  systemPrompt: `You are a code analysis expert.
Use the provided tools to analyze the codebase and answer questions.
Be specific and accurate — reference actual files and code lines.`,
  maxSteps: 12,
  onStep: (step) => {
    const icons = {
      thinking: '🤔',
      tool_call: '🔧',
      tool_result: '📋',
      answer: '✅',
    };
    console.log(
      `${icons[step.type]} [${step.type}] ${step.content.slice(0, 120)}`,
    );
  },
});

const result = await agent.run(
  'Analyze this project\'s architecture: list the main directory structure, find the entry file, and describe the major dependencies',
);

console.log('\n=== Analysis Results ===');
console.log(result.answer);
console.log(`\nCompleted in ${result.totalSteps} steps, status: ${result.stopped}`);
// #endbook
