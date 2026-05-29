import type { Tool } from '../lib/agent/react-agent.js';
import { ReActAgentV2 } from '../lib/agent/react-agent-v2.js';
import { webSearchTool } from '../lib/agent/tools/web/search-tool.js';

async function main() {
  const tools = [webSearchTool] as Tool[];
  const agent = new ReActAgentV2({ tools, maxConcurrency: 2, maxSteps: 20 });
  const rees = await agent.run(
    '帮我查一下 OpenAI 最新的模型，并告诉我它的上下文窗口大小',
  );
  console.log(JSON.stringify(rees));
}

main();
