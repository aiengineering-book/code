// Sliding-window chunking (ch12 pitfall: chunk boundary cutting key context)

interface ChunkOptions {
  chunkSize: number; // Target characters per chunk
  overlap: number; // Overlapping characters between adjacent chunks
}

export function chunkWithOverlap(
  text: string,
  options: ChunkOptions,
): string[] {
  const { chunkSize, overlap } = options;
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));

    // Next chunk starts at (end - overlap), not at end
    start = end - overlap;

    // Guard against infinite loop (when remaining text is shorter than overlap)
    if (start >= text.length - overlap) break;
  }

  return chunks;
}

// Recommended: chunk size 800 chars, overlap 150 chars
// ~15-20% overlap ratio; too low still leaves boundary issues, too high raises cost and duplicates results
export const DEFAULT_CHUNK_OPTIONS: ChunkOptions = {
  chunkSize: 800,
  overlap: 150,
};

// Split on semantic boundaries (paragraphs); paragraphs over maxChunkSize are re-split with a sliding window
export function chunkBySemantic(text: string, maxChunkSize = 800): string[] {
  // Split on double newlines (paragraph boundaries)
  const paragraphs = text.split(/\n{2,}/);
  const chunks: string[] = [];
  let currentChunk = '';

  for (const para of paragraphs) {
    if (
      (currentChunk + para).length > maxChunkSize &&
      currentChunk.length > 0
    ) {
      chunks.push(currentChunk.trim());
      currentChunk = para;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + para;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}
