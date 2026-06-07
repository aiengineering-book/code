// #book-ref ch12-production-rag/server/src/lib/hallucination-detector.ts

import { callLLM } from './llm.js';

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
      unsupportedClaims: [
        'No reference materials — all content may be hallucinated',
      ],
      supportedClaims: [],
    };
  }

  const { text } = await callLLM(
    [
      {
        role: 'user',
        content: `You are a strict fact-checking assistant.

Reference materials:
<context>
${contexts.slice(0, 5).join('\n\n---\n\n')}
</context>

Answer to verify:
<answer>
${answer}
</answer>

Identify which statements in the answer are supported by the reference materials and which are not.
Output JSON: {"supported": [...], "unsupported": [...], "confidence": 0.0-1.0}
Output JSON only.`,
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
