// Stub: ch16 只需要 getToolsForRole 的类型签名，完整工具定义见 ch14/ch15
import type { Tool } from '../react-agent.js';

export function getToolsForRole(_role: 'viewer' | 'editor' | 'admin'): Tool[] {
  // 生产环境替换为实际工具集
  return [];
}
