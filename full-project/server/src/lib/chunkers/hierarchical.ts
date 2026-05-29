// #book-ref ch12-production-rag/server/src/lib/chunkers/hierarchical.ts
import type { TextChunk } from './fixed-size.js';

export interface HierarchicalChunk extends TextChunk {
  level: 'section' | 'paragraph' | 'sentence';
  parentIndex?: number; // Index of the parent chunk
  sectionTitle?: string; // Title of the containing section
}

/**
 * Hierarchical chunking: extract the Markdown heading structure
 * Falls back to paragraph chunking for unstructured documents
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

    // Detect Markdown headings (H1-H3)
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/);

    if (headingMatch || i === lines.length - 1) {
      // Save the current section
      if (currentSection.trim()) {
        const sectionChunk: HierarchicalChunk = {
          content: currentSection.trim(),
          index: chunkIndex,
          startChar: 0, // Simplified: not tracking character offset
          endChar: currentSection.length,
          level: 'section',
          sectionTitle: currentSectionTitle,
        };
        chunks.push(sectionChunk);
        const sectionIdx = chunkIndex;
        chunkIndex++;

        // Split the section further into paragraphs
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

      // Start a new section
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
