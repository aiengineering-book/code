// #book-ref ch12-production-rag/server/src/lib/parsers/text-parser.ts
import type { DocumentParser, ParsedDocument } from './types.js';

export const textParser: DocumentParser = {
  supportedTypes: ['text/plain', 'text/csv'],

  async parse(buffer: Buffer, filename: string): Promise<ParsedDocument> {
    const text = buffer.toString('utf-8').trim();
    return {
      text,
      metadata: {
        title: filename,
        wordCount: text.split(/\s+/).length,
      },
    };
  },
};
