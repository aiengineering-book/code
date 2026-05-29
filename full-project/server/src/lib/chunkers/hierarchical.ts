// #book-ref ch12-production-rag/server/src/lib/chunkers/hierarchical.ts
import type { TextChunk } from './fixed-size.js';

export interface HierarchicalChunk extends TextChunk {
  level: 'section' | 'paragraph' | 'sentence';
  parentIndex?: number; // 父块的 index
  sectionTitle?: string; // 所属章节标题
}

/**
 * 层级分块：提取 Markdown 的层级结构
 * 对于无结构文档，退化为段落分块
 */
export function hierarchicalChunk(text: string): HierarchicalChunk[] {
  const chunks: HierarchicalChunk[] = [];
  const lines = text.split('\n');

  let currentSection = '';
  let currentSectionTitle = '';
  const _sectionStartLine = 0;
  let chunkIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    // 检测 Markdown 标题（H1-H3）
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/);

    if (headingMatch || i === lines.length - 1) {
      // 保存当前章节
      if (currentSection.trim()) {
        const sectionChunk: HierarchicalChunk = {
          content: currentSection.trim(),
          index: chunkIndex,
          startChar: 0, // 简化：不追踪字符偏移
          endChar: currentSection.length,
          level: 'section',
          sectionTitle: currentSectionTitle,
        };
        chunks.push(sectionChunk);
        const sectionIdx = chunkIndex;
        chunkIndex++;

        // 将章节进一步切分为段落
        const paragraphs = currentSection.trim().split(/\n\n+/);
        for (const para of paragraphs) {
          if (para.trim() && para.trim() !== currentSectionTitle) {
            chunks.push({
              content: para.trim(),
              index: chunkIndex++,
              startChar: 0,
              endChar: para.length,
              level: 'paragraph',
              parentIndex: sectionIdx,
              sectionTitle: currentSectionTitle,
            });
          }
        }
      }

      // 开始新章节
      if (headingMatch) {
        currentSectionTitle = headingMatch[2] ?? '';
        currentSection = `${line}\n`;
      }
    } else {
      currentSection += `${line}\n`;
    }
  }

  return chunks;
}
