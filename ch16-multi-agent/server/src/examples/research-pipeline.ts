// #book ch16-research-pipeline
// ch16-multi-agent/server/src/examples/research-pipeline.ts
import { AgentPipeline } from '../lib/agent/multi/pipeline.js';
import { fetchWebpageTool } from '../lib/agent/tools/browser-tools.js';
import { writeFileTool } from '../lib/agent/tools/file-tools.js';
import { runNodeCodeTool } from '../lib/agent/tools/shell-tools.js';

const researchPipeline = new AgentPipeline(
  [
    // Stage 1: Collect information
    {
      name: 'Information Gathering',
      description: 'You are a researcher responsible for collecting information about a given topic from the web.',
      tools: [fetchWebpageTool],
      maxSteps: 6,
      buildPrompt: (_, originalInput) =>
        `Gather key information on the following topic, including recent developments, major viewpoints, and important data:\n\n${originalInput}`,
    },

    // Stage 2: Data analysis
    {
      name: 'Data Analysis',
      description: 'You are a data analyst responsible for extracting key insights from collected information.',
      tools: [runNodeCodeTool],
      maxSteps: 4,
      buildPrompt: (previousOutput, originalInput) =>
        `Based on the following collected information, perform in-depth analysis of "${originalInput}", extracting key insights and trends:\n\n${previousOutput}`,
      validate: (output) => ({
        valid: output.length > 200,
        reason: 'Analysis output is too short',
      }),
    },

    // Stage 3: Report generation
    {
      name: 'Report Generation',
      description: 'You are a technical writer responsible for organizing analysis results into a structured report.',
      tools: [writeFileTool],
      maxSteps: 3,
      buildPrompt: (previousOutput, originalInput) =>
        `Organize the following analysis into a professional research report (Markdown format) on the topic: ${originalInput}.
Include: executive summary, key findings, detailed analysis, conclusions and recommendations.
Save the report as reports/research-report.md.

Analysis content:\n${previousOutput}`,
    },
  ],
  2, // Maximum 2 retries
  (stageName, output) => {
    console.log(`\n✅ Stage complete: ${stageName}`);
    console.log(`Output preview: ${output.slice(0, 200)}...`);
  },
);

// Run
const result = await researchPipeline.run(
  'TypeScript ecosystem trends and state in 2026',
);
console.log('\n=== Final Report ===');
console.log(result.finalOutput);
// #endbook
