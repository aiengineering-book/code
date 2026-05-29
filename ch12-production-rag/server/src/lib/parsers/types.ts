// #book-ref ch11-rag/server/src/lib/parsers/types.ts
export interface ParsedDocument {
  // 提取的纯文本内容
  text: string;
  // 文档元数据
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
  // 支持的 MIME 类型
  supportedTypes: string[];
  // 解析文档
  parse(buffer: Buffer, filename: string): Promise<ParsedDocument>;
}
