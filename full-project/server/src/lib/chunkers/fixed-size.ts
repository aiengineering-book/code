// #book-ref ch12-production-rag/server/src/lib/chunkers/fixed-size.ts
export interface ChunkOptions {
  chunkSize: number; // Target size per chunk (in characters)
  overlap: number; // Overlapping characters between adjacent chunks
}

export interface TextChunk {
  content: string;
  index: number;
  startChar: number;
  endChar: number;
}

export function fixedSizeChunk(
  text: string,
  options: ChunkOptions = { chunkSize: 1000, overlap: 200 },
): TextChunk[] {
  const { chunkSize, overlap } = options;
  const chunks: TextChunk[] = [];
  let start = 0;
  let index = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const content = text.slice(start, end).trim();

    if (content.length > 0) {
      chunks.push({ content, index, startChar: start, endChar: end });
      index++;
    }

    // Next chunk starts at (end - overlap) to implement overlap
    start = end - overlap;

    // Guard against infinite loop (when text is shorter than chunkSize)
    if (start >= text.length || end === text.length) break;
  }

  return chunks;
}
