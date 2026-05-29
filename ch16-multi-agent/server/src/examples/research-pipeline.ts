// #book ch16-research-pipeline
import { AgentPipeline } from '../lib/agent/multi/pipeline.js';
// ch16-multi-agent/server/src/examples/research-pipeline.ts
import { fetchWebpageTool } from '../lib/agent/tools/browser-tools.js';
import { writeFileTool } from '../lib/agent/tools/file-tools.js';
import { runNodeCodeTool } from '../lib/agent/tools/shell-tools.js';

const researchPipeline = new AgentPipeline(
  [
    // 阶段一：收集信息
    {
      name: '信息收集',
      description: '你是一个研究员，负责从网络收集关于指定主题的信息。',
      tools: [fetchWebpageTool],
      maxSteps: 6,
      buildPrompt: (_, originalInput) =>
        `搜集以下主题的关键信息，包括最新动态、主要观点和重要数据：\n\n${originalInput}`,
    },

    // 阶段二：数据分析
    {
      name: '数据分析',
      description: '你是一个数据分析师，负责从收集的信息中提取关键洞察。',
      tools: [runNodeCodeTool],
      maxSteps: 4,
      buildPrompt: (previousOutput, originalInput) =>
        `基于以下收集到的信息，对"${originalInput}"进行深入分析，提取关键洞察和趋势：\n\n${previousOutput}`,
      validate: (output) => ({
        valid: output.length > 200,
        reason: '分析内容过短',
      }),
    },

    // 阶段三：报告生成
    {
      name: '报告生成',
      description: '你是一个技术写作专家，负责将分析结果整理为结构化报告。',
      tools: [writeFileTool],
      maxSteps: 3,
      buildPrompt: (previousOutput, originalInput) =>
        `将以下分析结果整理为一份专业的研究报告（Markdown 格式），主题：${originalInput}。
包含：执行摘要、主要发现、详细分析、结论与建议。
最后将报告保存为 reports/research-report.md。

分析内容：\n${previousOutput}`,
    },
  ],
  2, // 最多重试 2 次
  (stageName, output) => {
    console.log(`\n✅ 阶段完成：${stageName}`);
    console.log(`输出预览：${output.slice(0, 200)}...`);
  },
);

// 运行
const result = await researchPipeline.run(
  'TypeScript 在 2026 年的发展趋势与生态现状',
);
console.log('\n=== 最终报告 ===');
console.log(result.finalOutput);
// #endbook
