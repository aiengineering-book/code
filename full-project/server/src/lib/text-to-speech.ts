// #book-ref ch22-text-to-speech
import OpenAI from 'openai';
import { env } from '../env.js';

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

export type TTSVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';

// 各声音的特点（供 LLM 选择参考）
export const VOICE_DESCRIPTIONS: Record<TTSVoice, string> = {
  alloy: '中性，平衡',
  echo: '男性，清晰',
  fable: '温暖，叙事感强',
  onyx: '深沉，权威',
  nova: '活泼，友好',
  shimmer: '柔和，细腻',
};

/**
 * 文字转语音，返回 MP3 Buffer
 */
export async function textToSpeech(
  text: string,
  options: {
    voice?: TTSVoice;
    speed?: number; // 0.25 ~ 4.0，默认 1.0
    model?: 'tts-1' | 'tts-1-hd'; // tts-1 更快，tts-1-hd 质量更高
  } = {},
): Promise<Buffer> {
  const { voice = 'nova', speed = 1.0, model = 'tts-1' } = options;

  // TTS 有字数限制（4096 字符）
  if (text.length > 4096) {
    throw new Error('文字不能超过 4096 字符，请分段处理');
  }

  const response = await openai.audio.speech.create({
    model,
    voice,
    input: text,
    speed,
    response_format: 'mp3',
  });

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * 长文本分段转语音
 */
export async function textToSpeechLong(
  text: string,
  options: Parameters<typeof textToSpeech>[1] = {},
): Promise<Buffer> {
  const MAX_CHUNK = 4000; // 留一点余量

  // 按句子分割，避免在词语中间截断
  const sentences = text.match(/[^。！？.!?]+[。！？.!?]?/g) ?? [text];
  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    if ((current + sentence).length > MAX_CHUNK) {
      if (current) chunks.push(current.trim());
      current = sentence;
    } else {
      current += sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());

  // 并发生成各段（但保持顺序）
  const buffers = await Promise.all(
    chunks.map((chunk) => textToSpeech(chunk, options)),
  );

  // 合并 Buffer（简单拼接 MP3 段）
  return Buffer.concat(buffers);
}
// #endbook-ref
