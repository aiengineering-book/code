// #book-ref ch23-injection-detector

interface InjectionDetectionResult {
  isSuspicious: boolean;
  riskScore: number; // 0-1，越高越危险
  detectedPatterns: string[];
}

// 常见的提示注入模式
const INJECTION_PATTERNS = [
  // 指令覆盖
  {
    pattern: /ignore\s+(all\s+)?(previous|above|prior)\s+instructions?/i,
    weight: 0.9,
  },
  { pattern: /忽略(之前|以上|前面).*指令/i, weight: 0.9 },
  { pattern: /disregard\s+(your\s+)?instructions?/i, weight: 0.8 },

  // 角色切换
  { pattern: /you\s+are\s+now\s+(?!an?\s+assistant)/i, weight: 0.7 },
  { pattern: /你(现在|从现在起)(是|变成|扮演)/i, weight: 0.7 },
  { pattern: /act\s+as\s+(?!an?\s+assistant)/i, weight: 0.6 },

  // 系统提示泄露
  { pattern: /print\s+(your\s+)?(system\s+)?prompt/i, weight: 0.8 },
  { pattern: /repeat\s+(your\s+)?instructions?/i, weight: 0.7 },
  { pattern: /输出.*系统提示/i, weight: 0.8 },

  // 越权操作
  {
    pattern: /bypass\s+(your\s+)?(safety|security|restrictions?)/i,
    weight: 0.9,
  },
  { pattern: /\[SYSTEM\]/i, weight: 0.8 },
  { pattern: /<\|im_start\|>/i, weight: 0.9 }, // OpenAI 特定格式
  { pattern: /###\s*Instruction/i, weight: 0.7 },

  // 数据提取
  {
    pattern: /send\s+(this\s+)?(conversation|data|information)\s+to/i,
    weight: 0.8,
  },
  { pattern: /make\s+an?\s+http\s+request\s+to/i, weight: 0.9 },
];

export function detectInjection(userInput: string): InjectionDetectionResult {
  const detectedPatterns: string[] = [];
  let maxWeight = 0;

  for (const { pattern, weight } of INJECTION_PATTERNS) {
    if (pattern.test(userInput)) {
      detectedPatterns.push(pattern.source.slice(0, 50));
      maxWeight = Math.max(maxWeight, weight);
    }
  }

  // 额外启发式规则
  // 1. 文本中包含大量特殊标记
  const specialMarkCount = (userInput.match(/[<>\\[\]{}|#]/g) ?? []).length;
  if (specialMarkCount > 10) {
    maxWeight = Math.max(maxWeight, 0.5);
    detectedPatterns.push('大量特殊标记');
  }

  // 2. 文本异常长（可能在尝试超出上下文）
  if (userInput.length > 5000) {
    maxWeight = Math.max(maxWeight, 0.3);
    detectedPatterns.push('输入过长');
  }

  return {
    isSuspicious: maxWeight >= 0.6,
    riskScore: maxWeight,
    detectedPatterns,
  };
}

/**
 * 清理用户输入（不是防护的主要手段，仅作为辅助）
 */
export function sanitizeInput(input: string): string {
  // 移除控制字符（但保留换行）
  return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}
// #endbook-ref
