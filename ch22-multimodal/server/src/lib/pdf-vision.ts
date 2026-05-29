// #book ch22-pdf-vision
import pdfParse from 'pdf-parse';
// ch22-multimodal/server/src/lib/pdf-vision.ts
import { analyzeImage } from './vision.js';

export interface PDFAnalysisResult {
  text: string; // 提取的文字
  pageCount: number;
  hasImages: boolean;
  summary?: string | undefined; // Vision 生成的综合摘要
}

/**
 * 智能 PDF 解析：文字提取 + 可选的 Vision 分析
 */
export async function analyzePDF(
  pdfBuffer: Buffer,
  options: {
    extractImages?: boolean; // 是否用 Vision 分析页面图像
    generateSummary?: boolean;
  } = {},
): Promise<PDFAnalysisResult> {
  // 1. 提取文字
  const parsed = await pdfParse(pdfBuffer);
  const extractedText = parsed.text.trim();
  const pageCount = parsed.numpages;

  // 2. 如果不需要图像分析，直接返回
  if (!options.extractImages && !options.generateSummary) {
    return {
      text: extractedText,
      pageCount,
      hasImages: false,
    };
  }

  // 3. 将 PDF 页面转换为图像进行 Vision 分析
  // 使用 pdf2pic 或 pdftoppm（需要系统安装 poppler-utils）
  // 这里展示概念实现
  let summary: string | undefined;

  if (options.generateSummary && extractedText) {
    // 如果有足够的文字内容，直接用文字生成摘要
    const { callLLM } = await import('./llm.js');
    summary = await callLLM(
      [
        {
          role: 'user',
          content: `请对以下 PDF 内容生成一份简洁的摘要（300 字以内）：\n\n${extractedText.slice(0, 5000)}`,
        },
      ],
      { temperature: 0.3 },
    );
  }

  return {
    text: extractedText,
    pageCount,
    hasImages: pdfBuffer.toString('binary').includes('/XObject'),
    summary,
  };
}

/**
 * 专门针对扫描版 PDF（无文字层）的 OCR
 * 依赖：pnpm add pdf2pic --filter server
 * 系统依赖：poppler-utils（brew install poppler 或 apt-get install poppler-utils）
 */
export async function ocrScannedPDF(pdfBuffer: Buffer): Promise<string> {
  // @ts-expect-error — pdf2pic 需要系统安装 poppler-utils，见书稿 22.5 的安装说明
  const { fromBuffer } = await import('pdf2pic');

  // 300 DPI 足够 OCR 用，过高会增加 Vision Token 消耗
  const convert = fromBuffer(pdfBuffer, {
    density: 300,
    format: 'png',
    width: 2480, // A4 @ 300dpi
    height: 3508,
  });

  const parsed = await pdfParse(pdfBuffer);
  const pageCount = parsed.numpages;

  // 逐页渲染为 PNG（responseType: 'base64' 表示不写磁盘，直接返回 base64）
  const pageImages = await Promise.all(
    Array.from({ length: pageCount }, (_, i) =>
      convert(i + 1, { responseType: 'base64' }),
    ),
  );

  // 对每页图像并发做 Vision OCR，保持页码顺序
  const texts = await Promise.all(
    pageImages.map((img) =>
      analyzeImage(
        { base64: img.base64 as string, mediaType: 'image/png' },
        '请识别并输出这张图片中所有的文字，保持原有的格式和段落结构。',
      ),
    ),
  );

  return texts.join('\n\n---\n\n');
}
// #endbook
