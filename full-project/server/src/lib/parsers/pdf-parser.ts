// #book-ref ch12-production-rag/server/src/lib/parsers/pdf-parser.ts
import pdfParse from 'pdf-parse';
import type { DocumentParser, ParsedDocument } from './types.js';

export const pdfParser: DocumentParser = {
  supportedTypes: ['application/pdf'],

  async parse(buffer: Buffer, _filename: string): Promise<ParsedDocument> {
    const data = await pdfParse(buffer);

    // pdf-parse 提取的文本可能有多余的空白和换行，需要清理
    const cleanedText = data.text
      .replace(/\n{3,}/g, '\n\n') // 多个连续换行合并为两个
      .replace(/[ \t]+/g, ' ') // 多个空格合并为一个
      .replace(/^\s+|\s+$/gm, '') // 去除每行首尾空白
      .trim();

    return {
      text: cleanedText,
      metadata: {
        pageCount: data.numpages,
        // pdf-parse 从元数据中提取
        title: data.info?.Title as string | undefined,
        author: data.info?.Author as string | undefined,
        wordCount: cleanedText.split(/\s+/).length,
      },
    };
  },
};
