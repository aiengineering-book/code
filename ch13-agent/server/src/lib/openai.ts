// #book-ref ch12-production-rag/server/src/lib/openai.ts
import OpenAI from 'openai';
import { ProxyAgent, setGlobalDispatcher } from 'undici';
import { env } from '../env.js';

const proxyUrl = process.env.HTTPS_PROXY ?? process.env.HTTP_PROXY;

if (proxyUrl) {
  setGlobalDispatcher(new ProxyAgent(proxyUrl));
}

export const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
  timeout: 5 * 60 * 1000,
  maxRetries: 0,
});

export const DEFAULT_MODEL = 'gpt-4o';
