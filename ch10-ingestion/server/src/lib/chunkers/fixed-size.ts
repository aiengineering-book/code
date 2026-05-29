// #book ch10-fixed-chunk
// ch10-ingestion/server/src/lib/chunkers/fixed-size.ts

export interface ChunkOptions {
  chunkSize: number; // Target chunk size in characters
  overlap: number;   // Overlap between adjacent chunks in characters
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

    // Next chunk starts at (end - overlap) to create the overlap
    start = end - overlap;

    // Prevent infinite loop (when text is shorter than chunkSize)
    if (start >= text.length || end === text.length) break;
  }

  return chunks;
}
// #endbook
