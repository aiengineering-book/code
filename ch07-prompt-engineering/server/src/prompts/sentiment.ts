// #book ch07-sentiment-prompt
// ch07-prompt-engineering/server/src/prompts/sentiment.ts
import { callLLM } from '../lib/llm.js';

const SENTIMENT_SYSTEM = `
You are a sentiment analysis assistant. Analyze the sentiment of customer reviews.

Output format (follow exactly):
{"sentiment": "positive|negative|neutral", "confidence": 0.0-1.0, "reason": "one sentence explanation"}

Examples:

Input: This phone is absolutely amazing — the camera quality is incredible!
Output: {"sentiment": "positive", "confidence": 0.95, "reason": "User expressed strong positive emotion about the phone and camera"}

Input: It's alright, about what I expected.
Output: {"sentiment": "neutral", "confidence": 0.78, "reason": "User expressed mild satisfaction with no strong positive or negative feeling"}

Input: Delivery was slow and the packaging arrived damaged. Would not recommend.
Output: {"sentiment": "negative", "confidence": 0.97, "reason": "User explicitly expressed dissatisfaction with shipping and packaging"}
`.trim();

export async function analyzeSentiment(text: string) {
  const response = await callLLM([{ role: 'user', content: text }], {
    system: SENTIMENT_SYSTEM,
    temperature: 0,
  });
  return response.text;
}
// #endbook
