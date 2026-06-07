// #book-ref ch10-ingestion/server/src/lib/parsers/html-parser.ts

import { parse as parseHtml } from 'node-html-parser';
import type { DocumentParser, ParsedDocument } from './types.js';

export const htmlParser: DocumentParser = {
  supportedTypes: ['text/html'],

  async parse(buffer: Buffer, filename: string): Promise<ParsedDocument> {
    const html = buffer.toString('utf-8');
    const root = parseHtml(html);

    // Extract metadata
    const title =
      root.querySelector('title')?.text ??
      root.querySelector('h1')?.text ??
      filename;

    const description = root
      .querySelector('meta[name="description"]')
      ?.getAttribute('content');

    // Remove non-content elements
    root
      .querySelectorAll('script, style, nav, footer, header, aside')
      .forEach((el) => el.remove());

    // Extract main content area (prefer semantic elements)
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
