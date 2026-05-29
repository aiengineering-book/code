// #book-ref ch11-rag/server/src/lib/openai.ts
import OpenAI from 'openai';
import { ProxyAgent, setGlobalDispatcher } from 'undici';
import { env } from '../env.js';

const proxyUrl = process.env.HTTPS_PROXY ?? process.env.HTTP_PROXY;

if (proxyUrl) {
  setGlobalDispatcher(new ProxyAgent(proxyUrl));
}

export const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
  timeout: 5 * 60 * 1000, // 5 分钟——长回复 + 流式可能真的要这么久
  maxRetries: 0, // 关掉 SDK 内置重试，6.7 里自己写一版能感知 429 和流式计费的
});

export const DEFAULT_MODEL = 'gpt-4o';
