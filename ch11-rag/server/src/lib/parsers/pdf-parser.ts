// #book-ref ch10-ingestion/server/src/lib/parsers/pdf-parser.ts
import pdfParse from 'pdf-parse';
import type { DocumentParser, ParsedDocument } from './types.js';

export const pdfParser: DocumentParser = {
  supportedTypes: ['application/pdf'],

  async parse(buffer: Buffer, _filename: string): Promise<ParsedDocument> {
    const data = await pdfParse(buffer);

    // pdf-parse may leave extra whitespace and newlines — clean them up
    const cleanedText = data.text
      .replace(/\n{3,}/g, '\n\n') // collapse 3+ consecutive newlines into 2
      .replace(/[ \t]+/g, ' ') // collapse multiple spaces into one
      .replace(/^\s+|\s+$/gm, '') // trim leading/trailing whitespace from each line
      .trim();

    return {
      text: cleanedText,
      metadata: {
        pageCount: data.numpages,
        // pdf-parse extracts from metadata
        title: data.info?.Title as string | undefined,
        author: data.info?.Author as string | undefined,
        wordCount: cleanedText.split(/\s+/).length,
      },
    };
  },
};
