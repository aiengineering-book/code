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
      for (const line of frontmatterMatch[1]?.split('\n')) {
        const [key, ...valueParts] = line.split(':');
        if (key && valueParts.length > 0) {
          metadata[key.trim()] = valueParts.join(':').trim();
        }
      }
    }

    // Strip Markdown syntax, keep plain text
    const plainText = content
      .replace(/#{1,6}\s+/g, '') // heading markers
      .replace(/\*\*(.+?)\*\*/g, '$1') // bold
      .replace(/\*(.+?)\*/g, '$1') // italic
      .replace(/`{3}[\s\S]*?`{3}/g, '') // code blocks (optionally keep content)
      .replace(/`(.+?)`/g, '$1') // inline code
      .replace(/\[(.+?)\]\(.+?\)/g, '$1') // links (keep text)
      .replace(/!\[.*?\]\(.+?\)/g, '') // images (remove)
      .replace(/^\s*[-*+]\s+/gm, '') // unordered list markers
      .replace(/^\s*\d+\.\s+/gm, '') // ordered list markers
      .replace(/^\s*>\s+/gm, '') // blockquote markers
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
