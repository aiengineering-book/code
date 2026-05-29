// #book-ref ch12-production-rag/server/src/lib/parsers/types.ts
export interface ParsedDocument {
  // Extracted plain-text content
  text: string;
  // Document metadata
  metadata: {
    title?: string | undefined;
    author?: string | undefined;
    pageCount?: number | undefined;
    wordCount?: number | undefined;
    language?: string | undefined;
    [key: string]: unknown;
  };
}

export interface DocumentParser {
  // Supported MIME types
  supportedTypes: string[];
  // Parse the document
  parse(buffer: Buffer, filename: string): Promise<ParsedDocument>;
}
