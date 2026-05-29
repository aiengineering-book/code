// ch14-tool-calling：工具调用深度实践
// 主要模块见 src/lib/agent/

export { ToolCallTracker } from './lib/agent/call-tracker.js';
export {
  executeToolsParallel,
  resultsToToolMessages,
} from './lib/agent/parallel-executor.js';
export type { AgentStep, Tool } from './lib/agent/react-agent.js';
export { ReActAgent } from './lib/agent/react-agent.js';
export type { AgentConfig, AgentResult } from './lib/agent/react-agent-v2.js';
export { ReActAgentV2 } from './lib/agent/react-agent-v2.js';
export { getToolStats, logToolCall } from './lib/agent/tool-observer.js';
export { ValidatedTool } from './lib/agent/tools/base-tool.js';
export { databaseQueryTool } from './lib/agent/tools/data/database-tool.js';
export type { UserRole } from './lib/agent/tools/index.js';
export {
  getToolsForRole,
  getToolsForScenario,
} from './lib/agent/tools/index.js';
export { testToolSelection } from './lib/agent/tools/tool-tester.js';
export { WeatherTool } from './lib/agent/tools/weather-tool.js';
export { webSearchTool } from './lib/agent/tools/web/search-tool.js';
