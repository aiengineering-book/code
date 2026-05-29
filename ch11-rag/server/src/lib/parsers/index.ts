// #book-ref ch10-ingestion/server/src/lib/parsers/index.ts
import { htmlParser } from './html-parser.js';
import { markdownParser } from './markdown-parser.js';
import { pdfParser } from './pdf-parser.js';
import { textParser } from './text-parser.js';
import type { DocumentParser, ParsedDocument } from './types.js';

const parsers: DocumentParser[] = [
  pdfParser,
  markdownParser,
  htmlParser,
  textParser,
];

/**
 * Select a parser based on MIME type
 */
export function getParser(mimeType: string): DocumentParser | null {
  return parsers.find((p) => p.supportedTypes.includes(mimeType)) ?? null;
}

export async function parseDocument(
  buffer: Buffer,
  filename: string,
  mimeType: string,
): Promise<ParsedDocument> {
  const parser = getParser(mimeType);

  if (!parser) {
    throw new Error(
      `Unsupported file type: ${mimeType}. Supported: PDF, Markdown, HTML, plain text`,
    );
  }

  return parser.parse(buffer, filename);
}

export type { ParsedDocument };
