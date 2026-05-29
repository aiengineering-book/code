// #book-ref ch12-production-rag/server/src/lib/parsers/markdown-parser.ts
import type { DocumentParser, ParsedDocument } from './types.js';

export const markdownParser: DocumentParser = {
  supportedTypes: ['text/markdown', 'text/x-markdown'],

  async parse(buffer: Buffer, filename: string): Promise<ParsedDocument> {
    const raw = buffer.toString('utf-8');

    // 提取 frontmatter 元数据（如果有）
    const frontmatterMatch = raw.match(/^---\n([\s\S]*?)\n---\n/);
    const metadata: Record<string, unknown> = {};
    let content = raw;

    if (frontmatterMatch) {
      content = raw.slice(frontmatterMatch[0].length);
      // 简单解析 YAML frontmatter（只处理 key: value 格式）
      for (const line of frontmatterMatch[1]?.split('\n')) {
        const [key, ...valueParts] = line.split(':');
        if (key && valueParts.length > 0) {
          metadata[key.trim()] = valueParts.join(':').trim();
        }
      }
    }

    // 去除 Markdown 语法符号，保留纯文本
    const plainText = content
      .replace(/#{1,6}\s+/g, '') // 标题符号
      .replace(/\*\*(.+?)\*\*/g, '$1') // 粗体
      .replace(/\*(.+?)\*/g, '$1') // 斜体
      .replace(/`{3}[\s\S]*?`{3}/g, '') // 代码块（可选：保留代码内容）
      .replace(/`(.+?)`/g, '$1') // 行内代码
      .replace(/\[(.+?)\]\(.+?\)/g, '$1') // 链接（保留文字）
      .replace(/!\[.*?\]\(.+?\)/g, '') // 图片（移除）
      .replace(/^\s*[-*+]\s+/gm, '') // 无序列表符号
      .replace(/^\s*\d+\.\s+/gm, '') // 有序列表符号
      .replace(/^\s*>\s+/gm, '') // 引用符号
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
