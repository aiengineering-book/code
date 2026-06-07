// #book-ref ch10-ingestion/server/src/lib/parsers/pdf-parser.ts

import pdfParse from 'pdf-parse';
import type { DocumentParser, ParsedDocument } from './types.js';

export const pdfParser: DocumentParser = {
  supportedTypes: ['application/pdf'],

  async parse(buffer: Buffer, _filename: string): Promise<ParsedDocument> {
    const data = await pdfParse(buffer);

    // Clean up the extracted text
    const cleanedText = data.text
      .replace(/\n{3,}/g, '\n\n') // Collapse multiple newlines to two
      .replace(/[ \t]+/g, ' ') // Collapse multiple spaces to one
      .replace(/^\s+|\s+$/gm, '') // Strip leading/trailing whitespace per line
      .trim();

    return {
      text: cleanedText,
      metadata: {
        pageCount: data.numpages,
        // Extracted from metadata by pdf-parse
        title: data.info?.Title as string | undefined,
        author: data.info?.Author as string | undefined,
        wordCount: cleanedText.split(/\s+/).length,
      },
    };
  },
};
