// #book-ref ch10-ingestion/server/src/lib/chunkers/semantic.ts

import { embedBatch } from '../embedding.js';
import { cosineSimilarity } from '../similarity.js';
import type { TextChunk } from './fixed-size.js';

/**
 * Semantic chunking: group similar sentences, split on topic transitions
 * @param breakpointThreshold Split when adjacent sentence similarity drops below this
 */
export async function semanticChunk(
  text: string,
  options: {
    maxChunkSize?: number;
    breakpointThreshold?: number;
  } = {},
): Promise<TextChunk[]> {
  const { maxChunkSize = 1500, breakpointThreshold = 0.7 } = options;

  // 1. Split into sentences (handles common punctuation)
  const sentences = text
    .split(/(?<=[.!?\n])\s*/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (sentences.length === 0) return [];
  if (sentences.length === 1) {
    return [
      { content: sentences[0]!, index: 0, startChar: 0, endChar: text.length },
    ];
  }

  // 2. Generate embeddings for all sentences
  console.log(
    `Semantic chunking: generating embeddings for ${sentences.length} sentences...`,
  );
  const embeddings = await embedBatch(sentences);

  // 3. Find breakpoints (adjacent sentences with low similarity)
  const breakpoints: number[] = [];

  for (let i = 0; i < sentences.length - 1; i++) {
    const sim = cosineSimilarity(
      embeddings[i]?.embedding,
      embeddings[i + 1]?.embedding,
    );

    // Similarity below threshold = topic jump = breakpoint
    if (sim < breakpointThreshold) {
      breakpoints.push(i + 1);
    }
  }

  // 4. Group sentences into chunks at breakpoints
  const chunks: TextChunk[] = [];
  let currentGroup: string[] = [];
  let chunkIndex = 0;
  let charOffset = 0;

  for (let i = 0; i < sentences.length; i++) {
    currentGroup.push(sentences[i]!);
    const currentText = currentGroup.join(' ');

    const isBreakpoint = breakpoints.includes(i + 1);
    const isLastSentence = i === sentences.length - 1;
    const isTooLarge = currentText.length > maxChunkSize;

    if (isBreakpoint || isLastSentence || isTooLarge) {
      if (currentText.trim()) {
        chunks.push({
          content: currentText.trim(),
          index: chunkIndex++,
          startChar: charOffset,
          endChar: charOffset + currentText.length,
        });
      }
      charOffset += currentText.length;
      currentGroup = [];
    }
  }

  return chunks;
}
