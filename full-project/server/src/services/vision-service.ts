// #book-ref ch22-multimodal/server/src/services/vision-service.ts

import { z } from 'zod';
import { analyzeImage } from '../lib/vision.js';

/**
 * Scenario 1: Screenshot bug analysis
 */
export async function analyzeScreenshot(imageBase64: string): Promise<string> {
  return analyzeImage(
    { base64: imageBase64, mediaType: 'image/png' },
    'This is an application screenshot. Please analyze:\n1. The main interface and content shown in the screenshot\n2. Any obvious UI issues, error messages, or abnormal states\n3. If there are issues, provide possible causes and fix recommendations',
    'You are a frontend UI diagnostics expert who can identify interface problems from screenshots.',
  );
}

/**
 * Scenario 2: Document OCR (structured extraction)
 */
const InvoiceSchema = z.object({
  invoiceNumber: z.string().nullable(),
  date: z.string().nullable(),
  amount: z.number().nullable(),
  currency: z.string().nullable(),
  vendor: z.string().nullable(),
  items: z.array(
    z.object({
      description: z.string(),
      quantity: z.number().nullable(),
      unitPrice: z.number().nullable(),
      total: z.number().nullable(),
    }),
  ),
});

export async function extractInvoiceData(imageBase64: string) {
  const { callLLM } = await import('../lib/llm.js');
  const text = await callLLM(
    [
      {
        role: 'user',
        content: [
          {
            type: 'image_url' as const,
            image_url: {
              url: `data:image/jpeg;base64,${imageBase64}`,
            },
          },
          {
            type: 'text' as const,
            text: `Extract structured data from this invoice image and output JSON:
{
  "invoiceNumber": "invoice number",
  "date": "issue date (YYYY-MM-DD)",
  "amount": total amount as number,
  "currency": "currency code",
  "vendor": "vendor name",
  "items": [
    {"description": "item description", "quantity": quantity, "unitPrice": unit price, "total": subtotal}
  ]
}
Fill null for any field that cannot be found. Output JSON only.`,
          },
        ],
      },
    ],
    { temperature: 0 },
  );

  return InvoiceSchema.parse(
    JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim()),
  );
}

/**
 * Scenario 3: Chart data extraction
 */
export async function extractChartData(imageBase64: string): Promise<string> {
  return analyzeImage(
    { base64: imageBase64, mediaType: 'image/png' },
    `Analyze this chart:
1. Chart type (line chart, bar chart, pie chart, etc.)
2. Axis labels and units
3. Data series names
4. Key data point values
5. Overall trends and patterns

Output in a structured format suitable for further processing.`,
  );
}

/**
 * Scenario 4: UI component recognition and code generation
 */
export async function generateUICode(
  imageBase64: string,
  framework = 'React + Tailwind',
): Promise<string> {
  return analyzeImage(
    { base64: imageBase64, mediaType: 'image/png' },
    `Generate ${framework} code corresponding to this UI design image.
Requirements:
- Reproduce the design layout and styles as closely as possible
- Use semantically named components
- Add necessary comments
- Code should be runnable directly`,
    'You are a professional frontend developer skilled at converting design mockups into high-quality code.',
  );
}
