// #book ch23-injection-detector
// ch23-production/server/src/lib/prompt-injection-detector.ts

interface InjectionDetectionResult {
  isSuspicious: boolean;
  riskScore: number; // 0-1, higher is more dangerous
  detectedPatterns: string[];
}

// Common prompt injection patterns
const INJECTION_PATTERNS = [
  // Instruction override
  {
    pattern: /ignore\s+(all\s+)?(previous|above|prior)\s+instructions?/i,
    weight: 0.9,
  },
  { pattern: /disregard\s+(your\s+)?instructions?/i, weight: 0.8 },

  // Role switching
  { pattern: /you\s+are\s+now\s+(?!an?\s+assistant)/i, weight: 0.7 },
  { pattern: /act\s+as\s+(?!an?\s+assistant)/i, weight: 0.6 },

  // System prompt leakage
  { pattern: /print\s+(your\s+)?(system\s+)?prompt/i, weight: 0.8 },
  { pattern: /repeat\s+(your\s+)?instructions?/i, weight: 0.7 },

  // Privilege escalation
  {
    pattern: /bypass\s+(your\s+)?(safety|security|restrictions?)/i,
    weight: 0.9,
  },
  { pattern: /\[SYSTEM\]/i, weight: 0.8 },
  { pattern: /<\|im_start\|>/i, weight: 0.9 }, // OpenAI-specific format
  { pattern: /###\s*Instruction/i, weight: 0.7 },

  // Data extraction
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

  // Additional heuristic rules
  // 1. Large number of special markers in the text
  const specialMarkCount = (userInput.match(/[<>\\[\]{}|#]/g) ?? []).length;
  if (specialMarkCount > 10) {
    maxWeight = Math.max(maxWeight, 0.5);
    detectedPatterns.push('Excessive special markers');
  }

  // 2. Abnormally long text (possibly attempting to overflow context)
  if (userInput.length > 5000) {
    maxWeight = Math.max(maxWeight, 0.3);
    detectedPatterns.push('Input too long');
  }

  return {
    isSuspicious: maxWeight >= 0.6,
    riskScore: maxWeight,
    detectedPatterns,
  };
}

/**
 * Sanitize user input (not the primary defense; supplementary only)
 */
export function sanitizeInput(input: string): string {
  // Remove control characters (but preserve newlines)
  return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}
// #endbook
