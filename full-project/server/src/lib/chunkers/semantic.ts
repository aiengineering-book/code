// #book-ref ch12-production-rag/server/src/lib/chunkers/semantic.ts
import { embedBatch } from '../embedding.js';
import { cosineSimilarity } from '../similarity.js';
import type { TextChunk } from './fixed-size.js';

/**
 * 语义分块：相似句子合并，相异句子分割
 * @param breakpointThreshold 当两个相邻句子的相似度低于此值时，在此处分块
 */
export async function semanticChunk(
  text: string,
  options: {
    maxChunkSize?: number;
    breakpointThreshold?: number;
  } = {},
): Promise<TextChunk[]> {
  const { maxChunkSize = 1500, breakpointThreshold = 0.7 } = options;

  // 1. 按句子分割（处理中英文标点）
  const sentences = text
    .split(/(?<=[。！？.!?\n])\s*/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (sentences.length === 0) return [];
  if (sentences.length === 1) {
    return [
      { content: sentences[0]!, index: 0, startChar: 0, endChar: text.length },
    ];
  }

  // 2. 为每个句子生成嵌入向量
  console.log(`语义分块：为 ${sentences.length} 个句子生成嵌入...`);
  const embeddings = await embedBatch(sentences);

  // 3. 计算相邻句子的相似度，找出分割点
  const breakpoints: number[] = [];

  for (let i = 0; i < sentences.length - 1; i++) {
    const sim = cosineSimilarity(
      embeddings[i]?.embedding,
      embeddings[i + 1]?.embedding,
    );

    // 相似度低于阈值 = 语义跳跃 = 分割点
    if (sim < breakpointThreshold) {
      breakpoints.push(i + 1);
    }
  }

  // 4. 按分割点合并句子为块
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
