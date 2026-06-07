// #book-ref ch16-multi-agent/server/src/lib/agent/multi/conflict-detector.ts

import { callLLM } from '../../llm.js';

interface SubtaskResult {
  agentId: string;
  task: string;
  output: string;
}

export async function detectAndResolveConflicts(
  results: SubtaskResult[],
): Promise<{ hasConflict: boolean; resolution: string }> {
  if (results.length <= 1) {
    return { hasConflict: false, resolution: results[0]?.output ?? '' };
  }

  const summaries = results
    .map(
      (r, i) =>
        `Agent ${i + 1} (responsible for: ${r.task}) conclusion:\n${r.output}`,
    )
    .join('\n\n---\n\n');

  const { text } = await callLLM(
    [
      {
        role: 'user',
        content: `The following are conclusions from multiple analysis Agents. Determine whether they have substantive conflicts (not wording differences, but opposing facts or recommendations).

${summaries}

Respond in JSON format:
{
  "hasConflict": true/false,
  "conflictPoints": ["conflict 1", "conflict 2"],  // empty array if no conflict
  "resolution": "consolidated recommendation or description of the conflict"
}

Output JSON only.`,
      },
    ],
    { temperature: 0, maxTokens: 1024 },
  );

  const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());

  return {
    hasConflict: parsed.hasConflict ?? false,
    resolution: parsed.hasConflict
      ? `⚠️ Conflicting analyses detected:\n${(parsed.conflictPoints as string[]).join('\n')}\n\n${parsed.resolution}`
      : parsed.resolution,
  };
}
