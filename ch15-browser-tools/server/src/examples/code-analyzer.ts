// #book ch15-code-analyzer
import 'dotenv/config';
// ch15-browser-tools/server/src/examples/code-analyzer.ts
import { ReActAgent } from '../lib/agent/react-agent.js';
import { getToolsForRole } from '../lib/agent/tools/index.js';

const agent = new ReActAgent({
  tools: getToolsForRole('viewer'),
  systemPrompt: `你是一个代码分析专家。
使用提供的工具分析代码库，回答用户的问题。
分析时要具体、准确，引用实际的文件和代码行。`,
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
  '分析这个项目的架构：列出主要的目录结构，找出入口文件，描述使用了哪些主要依赖',
);

console.log('\n=== 分析结果 ===');
console.log(result.answer);
console.log(`\n共执行 ${result.totalSteps} 步，状态：${result.stopped}`);
// #endbook
