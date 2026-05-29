// #book ch10-markdown-parser
// ch10-ingestion/server/src/lib/parsers/markdown-parser.ts
import type { DocumentParser, ParsedDocument } from './types.js';

export const markdownParser: DocumentParser = {
  supportedTypes: ['text/markdown', 'text/x-markdown'],

  async parse(buffer: Buffer, filename: string): Promise<ParsedDocument> {
    const raw = buffer.toString('utf-8');

    // Extract frontmatter metadata (if present)
    const frontmatterMatch = raw.match(/^---\n([\s\S]*?)\n---\n/);
    const metadata: Record<string, unknown> = {};
    let content = raw;

    if (frontmatterMatch) {
      content = raw.slice(frontmatterMatch[0].length);
      // Simple YAML frontmatter parse (key: value format only)
      for (const line of frontmatterMatch[1].split('\n')) {
        const [key, ...valueParts] = line.split(':');
        if (key && valueParts.length > 0) {
          metadata[key.trim()] = valueParts.join(':').trim();
        }
      }
    }

    // Strip Markdown syntax, keep plain text
    const plainText = content
      .replace(/#{1,6}\s+/g, '')              // Heading markers
      .replace(/\*\*(.+?)\*\*/g, '$1')        // Bold
      .replace(/\*(.+?)\*/g, '$1')            // Italic
      .replace(/`{3}[\s\S]*?`{3}/g, '')       // Code blocks (removed)
      .replace(/`(.+?)`/g, '$1')              // Inline code
      .replace(/\[(.+?)\]\(.+?\)/g, '$1')     // Links (keep text)
      .replace(/!\[.*?\]\(.+?\)/g, '')        // Images (remove)
      .replace(/^\s*[-*+]\s+/gm, '')          // Unordered list markers
      .replace(/^\s*\d+\.\s+/gm, '')          // Ordered list markers
      .replace(/^\s*>\s+/gm, '')              // Blockquote markers
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return {
      text: plainText,
      metadata: {
        ...metadata,
        wordCount: plainText.split(/\s+/).length,
        title:
          (metadata.title as string | undefined) ??
          filename.replace(/\.md$/, ''),
      },
    };
  },
};
// #endbook
