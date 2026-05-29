// #book-ref ch10-ingestion/server/src/lib/chunkers/fixed-size.ts
export interface ChunkOptions {
  chunkSize: number; // 每块的目标大小（字符数）
  overlap: number; // 相邻块的重叠字符数
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

    // 下一块从 (end - overlap) 开始，实现重叠
    start = end - overlap;

    // 防止死循环（当文本长度小于 chunkSize 时）
    if (start >= text.length || end === text.length) break;
  }

  return chunks;
}
