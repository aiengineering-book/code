// #book-ref ch22-multimodal/server/src/lib/pdf-vision.ts

import pdfParse from 'pdf-parse';
import { analyzeImage } from './vision.js';

export interface PDFAnalysisResult {
  text: string; // Extracted text
  pageCount: number;
  hasImages: boolean;
  summary?: string | undefined; // Vision-generated summary
}

/**
 * Smart PDF parsing: text extraction + optional Vision analysis
 */
export async function analyzePDF(
  pdfBuffer: Buffer,
  options: {
    extractImages?: boolean; // Whether to use Vision to analyze page images
    generateSummary?: boolean;
  } = {},
): Promise<PDFAnalysisResult> {
  // 1. Extract text
  const parsed = await pdfParse(pdfBuffer);
  const extractedText = parsed.text.trim();
  const pageCount = parsed.numpages;

  // 2. If no image analysis is needed, return directly
  if (!options.extractImages && !options.generateSummary) {
    return {
      text: extractedText,
      pageCount,
      hasImages: false,
    };
  }

  // 3. Convert PDF pages to images for Vision analysis
  // Use pdf2pic or pdftoppm (requires poppler-utils to be installed on the system)
  // This shows the conceptual implementation
  let summary: string | undefined;

  if (options.generateSummary && extractedText) {
    // If sufficient text content is available, generate summary from text
    const { callLLM } = await import('./llm.js');
    summary = await callLLM(
      [
        {
          role: 'user',
          content: `Please generate a concise summary (under 300 words) of the following PDF content:\n\n${extractedText.slice(0, 5000)}`,
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
 * OCR specifically for scanned PDFs (no text layer)
 * Dependency: pnpm add pdf2pic --filter server
 * System dependency: poppler-utils (brew install poppler or apt-get install poppler-utils)
 */
export async function ocrScannedPDF(pdfBuffer: Buffer): Promise<string> {
  // pdf2pic has no bundled type declarations; add a local .d.ts shim if needed.
  // @ts-expect-error
  const { fromBuffer } = await import('pdf2pic');

  // 300 DPI is sufficient for OCR; higher values increase Vision token consumption
  const convert = fromBuffer(pdfBuffer, {
    density: 300,
    format: 'png',
    width: 2480, // A4 @ 300dpi
    height: 3508,
  });

  const parsed = await pdfParse(pdfBuffer);
  const pageCount = parsed.numpages;

  // Render each page to PNG (responseType: 'base64' returns base64 without writing to disk)
  const pageImages = await Promise.all(
    Array.from({ length: pageCount }, (_, i) =>
      convert(i + 1, { responseType: 'base64' }),
    ),
  );

  // Run Vision OCR on each page concurrently, preserving page order
  const texts = await Promise.all(
    pageImages.map((img) =>
      analyzeImage(
        { base64: img.base64 as string, mediaType: 'image/png' },
        'Please recognize and output all text in this image, preserving the original formatting and paragraph structure.',
      ),
    ),
  );

  return texts.join('\n\n---\n\n');
}
