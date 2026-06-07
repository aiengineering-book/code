import type { Tool } from '../lib/agent/react-agent.js';
import { ReActAgentV2 } from '../lib/agent/react-agent-v2.js';
import { webSearchTool } from '../lib/agent/tools/web/search-tool.js';

async function main() {
  const tools = [webSearchTool] as Tool[];
  const agent = new ReActAgentV2({ tools, maxConcurrency: 2, maxSteps: 20 });
  const rees = await agent.run(
    'Look up the latest OpenAI models and tell me their context window sizes',
  );
  console.log(JSON.stringify(rees));
}

main();
