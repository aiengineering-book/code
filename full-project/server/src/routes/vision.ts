// #book-ref ch22-vision-route
import { type ErrorHandler, Hono } from 'hono';
import { ValidationError } from '../errors.js';
import { authMiddleware } from '../middleware/auth.js';
import {
  analyzeScreenshot,
  extractInvoiceData,
  generateUICode,
} from '../services/vision-service.js';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

export const errorHandler: ErrorHandler = (err, c) => {
  console.error('Unhandled error:', err);
  return c.json({ error: { message: 'Internal Server Error' } }, 500);
};

const visionRouter = new Hono()
  .use('*', authMiddleware)

  .post('/analyze', async (c) => {
    const formData = await c.req.formData();
    const image = formData.get('image') as File | null;
    const task = (formData.get('task') as string) ?? 'general';

    const ALLOWED_TYPES = [
      'image/png',
      'image/jpeg',
      'image/gif',
      'image/webp',
    ];

    if (!image) throw new ValidationError('请上传图片');
    if (image.size > MAX_IMAGE_SIZE)
      throw new ValidationError('图片不能超过 5MB');
    if (!ALLOWED_TYPES.includes(image.type)) {
      throw new ValidationError('只支持 PNG、JPEG、GIF、WebP 格式');
    }

    const buffer = await image.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');

    let result: string | object;

    try {
      switch (task) {
        case 'screenshot':
          result = await analyzeScreenshot(base64);
          break;
        case 'invoice':
          result = await extractInvoiceData(base64);
          break;
        case 'ui-code': {
          const framework =
            (formData.get('framework') as string) ?? 'React + Tailwind';
          result = await generateUICode(base64, framework);
          break;
        }
        default: {
          const { analyzeImage } = await import('../lib/vision.js');
          const prompt =
            (formData.get('prompt') as string) ?? '请描述这张图片的内容';
          result = await analyzeImage(
            { base64, mediaType: 'image/jpeg' },
            prompt,
          );
        }
      }
    } catch (error: any) {
      return errorHandler(error, c);
    }
    return c.json({ result });
  });

export default visionRouter;
// #endbook-ref
