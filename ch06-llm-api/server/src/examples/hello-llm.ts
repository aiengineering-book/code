// #book ch06-hello-llm
import { DEFAULT_MODEL, openai } from '../lib/openai.js';
// ch06-llm-api/server/src/examples/hello-llm.ts

async function main() {
  const response = await openai.chat.completions.create({
    model: DEFAULT_MODEL,
    max_completion_tokens: 1024, // 输出上限：最多生成 1024 Token 的回复
    messages: [{ role: 'user', content: '用一句话解释什么是递归。' }],
  });

  const choice = response.choices[0]!;
  console.log('停止原因:', choice.finish_reason);
  // stop        → 模型自然结束，正常
  // length      → 触达输出上限被截断，需要处理！
  // tool_calls  → 模型要调用工具（Part 4 详细介绍）

  console.log('输入 Token:', response.usage?.prompt_tokens);
  console.log('输出 Token:', response.usage?.completion_tokens);

  console.log('回复:', choice.message.content ?? '无文本');
}

main();
// #endbook
