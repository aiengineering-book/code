// #book-ref ch23-injection-guard
// ch23-production/server/src/middleware/injection-guard.ts
import type { MiddlewareHandler } from 'hono';
import { detectInjection } from '../lib/prompt-injection-detector.js';

export const injectionGuard: MiddlewareHandler = async (
  c,
  next,
): Promise<Response | undefined> => {
  // Only check POST requests with a JSON body
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
        // Log suspicious requests (don't tell the user why they were rejected)
        console.warn('[Security] Suspicious input detected:', {
          userId: c.get('userId'),
          patterns: result.detectedPatterns,
          riskScore: result.riskScore,
          path: c.req.path,
        });

        // High risk: reject immediately
        if (result.riskScore >= 0.8) {
          return c.json(
            {
              error: {
                code: 'INPUT_REJECTED',
                message: 'Input does not comply with usage policy',
              },
            },
            400,
          );
        }
        // Medium risk: log and allow through (let LLM system prompt handle it)
      }
    }
  } catch {
    // JSON parse failure, skip check
  }

  // Re-parse body (req.json() can only be read once)
  // A real implementation needs to clone the request or use the correct middleware pattern
  await next();
};
