// #book ch10-recursive-chunk
import type { TextChunk } from './fixed-size.js';
// ch10-ingestion/server/src/lib/chunkers/recursive.ts

// 分隔符优先级：段落 > 句子 > 词语 > 字符
const SEPARATORS = ['\n\n', '\n', '。', '！', '？', '.', '!', '?', ' ', ''];

export function recursiveChunk(
  text: string,
  options: { chunkSize: number; overlap: number } = {
    chunkSize: 1000,
    overlap: 200,
  },
): TextChunk[] {
  const chunks: TextChunk[] = [];
  splitRecursive(
    text,
    0,
    options.chunkSize,
    options.overlap,
    SEPARATORS,
    chunks,
  );
  return chunks;
}

function splitRecursive(
  text: string,
  startOffset: number,
  chunkSize: number,
  overlap: number,
  separators: string[],
  result: TextChunk[],
): void {
  // 文本足够短，直接作为一块
  if (text.length <= chunkSize) {
    if (text.trim()) {
      result.push({
        content: text.trim(),
        index: result.length,
        startChar: startOffset,
        endChar: startOffset + text.length,
      });
    }
    return;
  }

  // 尝试用当前分隔符切分
  const [separator, ...remainingSeparators] = separators;

  if (separator === undefined) {
    // 所有分隔符都试完了，强制按大小切分
    for (let i = 0; i < text.length; i += chunkSize - overlap) {
      const chunk = text.slice(i, i + chunkSize).trim();
      if (chunk) {
        result.push({
          content: chunk,
          index: result.length,
          startChar: startOffset + i,
          endChar: startOffset + Math.min(i + chunkSize, text.length),
        });
      }
    }
    return;
  }

  const parts = separator ? text.split(separator) : [text];

  let currentChunk = '';
  let currentStart = startOffset;

  for (const part of parts) {
    const candidate = currentChunk ? currentChunk + separator + part : part;

    if (candidate.length <= chunkSize) {
      currentChunk = candidate;
    } else {
      // 当前块已满，保存并开始新块
      if (currentChunk.trim()) {
        if (currentChunk.length > chunkSize) {
          // 当前块太大，递归用更细的分隔符切分
          splitRecursive(
            currentChunk,
            currentStart,
            chunkSize,
            overlap,
            remainingSeparators,
            result,
          );
        } else {
          result.push({
            content: currentChunk.trim(),
            index: result.length,
            startChar: currentStart,
            endChar: currentStart + currentChunk.length,
          });
        }
      }

      // 新块从 overlap 位置开始（实现重叠）
      const overlapText = currentChunk.slice(-overlap);
      currentChunk = overlapText ? overlapText + separator + part : part;
      currentStart += currentChunk.length - overlapText.length;
    }
  }

  // 处理最后一块
  if (currentChunk.trim()) {
    result.push({
      content: currentChunk.trim(),
      index: result.length,
      startChar: currentStart,
      endChar: currentStart + currentChunk.length,
    });
  }
}
// #endbook
