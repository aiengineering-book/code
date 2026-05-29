// 滑动窗口分块（12.7 坑一：chunk 边界切断关键上下文）

interface ChunkOptions {
  chunkSize: number; // 每个 Chunk 的目标字符数
  overlap: number; // 相邻 Chunk 的重叠字符数
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

    // 下一个 Chunk 从 (end - overlap) 开始，而不是从 end 开始
    start = end - overlap;

    // 防止无限循环（当剩余文本比 overlap 还短时）
    if (start >= text.length - overlap) break;
  }

  return chunks;
}

// 推荐参数：Chunk 800 字符，重叠 150 字符
// 重叠比例约 15-20%，太低边界问题仍存在，太高成本上升且检索结果重复
export const DEFAULT_CHUNK_OPTIONS: ChunkOptions = {
  chunkSize: 800,
  overlap: 150,
};

// 按语义边界（段落）切分，超过 maxChunkSize 的段落用滑动窗口二次切分
export function chunkBySemantic(text: string, maxChunkSize = 800): string[] {
  // 按双换行（段落边界）分割
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
