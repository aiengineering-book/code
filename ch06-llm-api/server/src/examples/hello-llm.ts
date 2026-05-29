// #book ch06-hello-llm
// ch06-llm-api/server/src/examples/hello-llm.ts
import { DEFAULT_MODEL, openai } from '../lib/openai.js';

async function main() {
  const response = await openai.chat.completions.create({
    model: DEFAULT_MODEL,
    max_completion_tokens: 1024, // Output cap: generate at most 1,024 tokens
    messages: [{ role: 'user', content: 'Explain recursion in one sentence.' }],
  });

  const choice = response.choices[0]!;
  console.log('Stop reason:', choice.finish_reason);
  // stop        → model finished naturally — normal
  // length      → hit the output cap, response is truncated — must handle!
  // tool_calls  → model wants to call a tool (covered in Part 4)

  console.log('Input tokens:', response.usage?.prompt_tokens);
  console.log('Output tokens:', response.usage?.completion_tokens);

  console.log('Response:', choice.message.content ?? '(no text)');
}

main();
// #endbook
