export const CODE_REVIEW_SYSTEM = `You are a code reviewer. Analyze code quality and provide structured feedback.`;

export interface CodeReview {
  score: number;
  summary: string;
  issues: Array<{ severity: 'high' | 'medium' | 'low'; description: string }>;
}

export function parseCodeReview(text: string): CodeReview {
  try {
    return JSON.parse(text) as CodeReview;
  } catch {
    return { score: 5, summary: text, issues: [] };
  }
}
