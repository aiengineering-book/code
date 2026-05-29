// #book-ref ch12-production-rag/server/src/lib/chunkers/recursive.ts
import type { TextChunk } from './fixed-size.js';

// Separator priority: paragraph > sentence > word > character
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
  // Text is short enough — use as a single chunk
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

  // Try splitting with the current separator
  const [separator, ...remainingSeparators] = separators;

  if (separator === undefined) {
    // All separators exhausted — force-split by size
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
      // Current chunk is full — save and start a new one
      if (currentChunk.trim()) {
        if (currentChunk.length > chunkSize) {
          // Current chunk too large — recurse with a finer separator
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

      // New chunk starts at the overlap position
      const overlapText = currentChunk.slice(-overlap);
      currentChunk = overlapText ? overlapText + separator + part : part;
      currentStart += currentChunk.length - overlapText.length;
    }
  }

  // Handle the final chunk
  if (currentChunk.trim()) {
    result.push({
      content: currentChunk.trim(),
      index: result.length,
      startChar: currentStart,
      endChar: currentStart + currentChunk.length,
    });
  }
}
