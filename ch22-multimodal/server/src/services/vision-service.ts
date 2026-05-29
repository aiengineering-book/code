// #book ch22-vision-service

// ch22-multimodal/server/src/services/vision-service.ts
import { z } from 'zod';
import { analyzeImage } from '../lib/vision.js';

/**
 * 场景一：截图 Bug 分析
 */
export async function analyzeScreenshot(imageBase64: string): Promise<string> {
  return analyzeImage(
    { base64: imageBase64, mediaType: 'image/png' },
    '这是一个应用截图。请分析：\n1. 截图中显示的主要界面和内容\n2. 是否有明显的 UI 问题、错误信息或异常状态\n3. 如果有问题，给出可能的原因和修复建议',
    '你是一个前端 UI 问题诊断专家，能从截图中识别界面问题。',
  );
}

/**
 * 场景二：文档 OCR（结构化提取）
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
            text: `从这张发票图片中提取结构化数据，输出 JSON：
{
  "invoiceNumber": "发票号码",
  "date": "开票日期（YYYY-MM-DD）",
  "amount": 总金额数字,
  "currency": "货币代码",
  "vendor": "供应商名称",
  "items": [
    {"description": "商品描述", "quantity": 数量, "unitPrice": 单价, "total": 小计}
  ]
}
所有未找到的字段填 null。只输出 JSON。`,
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
 * 场景三：图表数据提取
 */
export async function extractChartData(imageBase64: string): Promise<string> {
  return analyzeImage(
    { base64: imageBase64, mediaType: 'image/png' },
    `分析这张图表：
1. 图表类型（折线图、柱状图、饼图等）
2. 坐标轴标签和单位
3. 数据系列名称
4. 关键数据点的数值
5. 整体趋势和规律

用结构化格式输出，方便后续程序处理。`,
  );
}

/**
 * 场景四：UI 组件识别与代码生成
 */
export async function generateUICode(
  imageBase64: string,
  framework = 'React + Tailwind',
): Promise<string> {
  return analyzeImage(
    { base64: imageBase64, mediaType: 'image/png' },
    `根据这张 UI 设计图，生成对应的 ${framework} 代码。
要求：
- 尽量还原设计稿的布局和样式
- 使用语义化的组件命名
- 添加必要的注释
- 代码要可以直接运行`,
    '你是一个专业的前端开发者，擅长将设计稿转换为高质量代码。',
  );
}
// #endbook
