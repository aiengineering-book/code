// #book-ref ch11-rag/server/src/lib/parsers/index.ts
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
 * 根据 MIME 类型选择解析器
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
      `不支持的文件类型：${mimeType}。支持：PDF、Markdown、HTML、纯文本`,
    );
  }

  return parser.parse(buffer, filename);
}

export type { ParsedDocument };
