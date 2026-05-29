import OpenAI from 'openai';
import { ProxyAgent, setGlobalDispatcher } from 'undici';
import { env } from '../env.js';

const proxyUrl = process.env.HTTPS_PROXY ?? process.env.HTTP_PROXY;

console.log('proxyUrl ->', proxyUrl);
console.log('env.OPENAI_API_KEY ->', env.OPENAI_API_KEY);

if (proxyUrl) {
  setGlobalDispatcher(new ProxyAgent(proxyUrl));
}

export const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
  timeout: 5 * 60 * 1000, // 5 minutes — long responses + streaming can genuinely take this long
  maxRetries: 0, // Disable SDK built-in retry; ch06 implements a custom version aware of 429 and streaming billing
});

export const DEFAULT_MODEL = 'gpt-4o';
