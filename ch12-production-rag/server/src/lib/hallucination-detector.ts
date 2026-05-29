// #book ch12-hallucination-detector
import { callLLM } from './llm.js';
// ch12-production-rag/server/src/lib/hallucination-detector.ts

export interface HallucinationReport {
  hasHallucination: boolean;
  confidence: number;
  unsupportedClaims: string[];
  supportedClaims: string[];
}

export async function detectHallucination(
  answer: string,
  contexts: string[],
): Promise<HallucinationReport> {
  if (contexts.length === 0) {
    return {
      hasHallucination: true,
      confidence: 0.9,
      unsupportedClaims: ['无参考资料，所有内容均可能是幻觉'],
      supportedClaims: [],
    };
  }

  const { text } = await callLLM(
    [
      {
        role: 'user',
        content: `你是严格的事实核查助手。

参考资料：
<context>
${contexts.slice(0, 5).join('\n\n---\n\n')}
</context>

待核查答案：
<answer>
${answer}
</answer>

识别答案中哪些声明有参考资料支撑，哪些没有。
输出 JSON：{"supported": [...], "unsupported": [...], "confidence": 0.0-1.0}
只输出 JSON。`,
      },
    ],
    { temperature: 0 },
  );

  try {
    const parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim());
    const unsupported = (parsed.unsupported as string[]) ?? [];
    return {
      hasHallucination: unsupported.length > 0,
      confidence: parsed.confidence ?? 0.8,
      unsupportedClaims: unsupported,
      supportedClaims: (parsed.supported as string[]) ?? [],
    };
  } catch {
    return {
      hasHallucination: false,
      confidence: 0.3,
      unsupportedClaims: [],
      supportedClaims: [],
    };
  }
}
// #endbook
