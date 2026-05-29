// #book ch16-conflict-detector
import type OpenAI from 'openai';
// ch16-multi-agent/server/src/lib/agent/multi/conflict-detector.ts

interface SubtaskResult {
  agentId: string;
  task: string;
  output: string;
}

export async function detectAndResolveConflicts(
  client: OpenAI,
  results: SubtaskResult[],
): Promise<{ hasConflict: boolean; resolution: string }> {
  if (results.length <= 1) {
    return { hasConflict: false, resolution: results[0]?.output ?? '' };
  }

  const summaries = results
    .map((r, i) => `Agent ${i + 1}（负责：${r.task}）的结论：\n${r.output}`)
    .join('\n\n---\n\n');

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    max_completion_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `以下是多个分析 Agent 的结论。请判断它们是否有实质性矛盾（不是措辞差异，而是事实或建议相反）。

${summaries}

请用 JSON 格式回答：
{
  "hasConflict": true/false,
  "conflictPoints": ["矛盾点1", "矛盾点2"],  // 如果没矛盾则为空数组
  "resolution": "综合建议或矛盾说明"
}`,
      },
    ],
  });

  const text = response.choices[0]?.message.content ?? '{}';
  const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());

  return {
    hasConflict: parsed.hasConflict ?? false,
    resolution: parsed.hasConflict
      ? `⚠️ 检测到分析矛盾：\n${(parsed.conflictPoints as string[]).join('\n')}\n\n${parsed.resolution}`
      : parsed.resolution,
  };
}
// #endbook
