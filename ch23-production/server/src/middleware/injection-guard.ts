// #book ch23-injection-guard
import type { MiddlewareHandler } from 'hono';
// ch23-production/server/src/middleware/injection-guard.ts
import { detectInjection } from '../lib/prompt-injection-detector.js';

export const injectionGuard: MiddlewareHandler = async (
  c,
  next,
): Promise<Response | undefined> => {
  // 只检查 POST 请求的 JSON body
  if (c.req.method !== 'POST') {
    await next();
    return;
  }

  try {
    const body = await c.req.json();
    const textToCheck = [body.message, body.question, body.task, body.content]
      .filter((v) => typeof v === 'string')
      .join(' ');

    if (textToCheck) {
      const result = detectInjection(textToCheck);

      if (result.isSuspicious) {
        // 记录可疑请求（不要直接暴露给用户为什么被拒绝）
        console.warn('[Security] 检测到可疑输入：', {
          userId: c.get('userId'),
          patterns: result.detectedPatterns,
          riskScore: result.riskScore,
          path: c.req.path,
        });

        // 高风险直接拒绝
        if (result.riskScore >= 0.8) {
          return c.json(
            {
              error: {
                code: 'INPUT_REJECTED',
                message: '输入内容不符合使用规范',
              },
            },
            400,
          );
        }
        // 中等风险记录但放行（让 LLM 的系统提示处理）
      }
    }
  } catch {
    // JSON 解析失败，跳过检查
  }

  // 重新解析 body（因为 req.json() 只能读一次）
  // 实际实现需要 clone request 或使用 middleware 的正确模式
  await next();
};
// #endbook
