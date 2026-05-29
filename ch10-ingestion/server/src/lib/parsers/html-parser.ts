// #book ch10-html-parser
import { parse as parseHtml } from 'node-html-parser';
// ch10-ingestion/server/src/lib/parsers/html-parser.ts
import type { DocumentParser, ParsedDocument } from './types.js';

export const htmlParser: DocumentParser = {
  supportedTypes: ['text/html'],

  async parse(buffer: Buffer, filename: string): Promise<ParsedDocument> {
    const html = buffer.toString('utf-8');
    const root = parseHtml(html);

    // 提取元数据
    const title =
      root.querySelector('title')?.text ??
      root.querySelector('h1')?.text ??
      filename;

    const description = root
      .querySelector('meta[name="description"]')
      ?.getAttribute('content');

    // 移除不需要的元素
    root
      .querySelectorAll('script, style, nav, footer, header, aside')
      .forEach((el) => el.remove());

    // 提取 main 内容区域（如果存在）
    const mainContent =
      root.querySelector('main, article, .content, #content') ??
      root.querySelector('body') ??
      root;

    const text = mainContent.text
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/^\s+|\s+$/gm, '')
      .trim();

    return {
      text,
      metadata: {
        title,
        description,
        wordCount: text.split(/\s+/).length,
      },
    };
  },
};
// #endbook
