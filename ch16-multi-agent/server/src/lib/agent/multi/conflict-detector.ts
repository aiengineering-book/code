// #book ch16-conflict-detector
// ch16-multi-agent/server/src/lib/agent/multi/conflict-detector.ts
import type OpenAI from 'openai';

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
    .map((r, i) => `Agent ${i + 1} (responsible for: ${r.task}) conclusion:\n${r.output}`)
    .join('\n\n---\n\n');

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    max_completion_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `The following are conclusions from multiple analysis Agents. Determine whether they have substantive conflicts (not wording differences, but opposing facts or recommendations).

${summaries}

Respond in JSON format:
{
  "hasConflict": true/false,
  "conflictPoints": ["conflict 1", "conflict 2"],  // empty array if no conflict
  "resolution": "consolidated recommendation or description of the conflict"
}`,
      },
    ],
  });

  const text = response.choices[0]?.message.content ?? '{}';
  const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());

  return {
    hasConflict: parsed.hasConflict ?? false,
    resolution: parsed.hasConflict
      ? `⚠️ Conflicting analyses detected:\n${(parsed.conflictPoints as string[]).join('\n')}\n\n${parsed.resolution}`
      : parsed.resolution,
  };
}
// #endbook
