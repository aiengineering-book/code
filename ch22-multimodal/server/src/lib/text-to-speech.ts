// #book ch22-text-to-speech
// ch22-multimodal/server/src/lib/text-to-speech.ts
import OpenAI from 'openai';
import { env } from '../env.js';

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

export type TTSVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';

// Voice characteristics (for reference when selecting)
export const VOICE_DESCRIPTIONS: Record<TTSVoice, string> = {
  alloy: 'Neutral, balanced',
  echo: 'Male, clear',
  fable: 'Warm, strong narrative quality',
  onyx: 'Deep, authoritative',
  nova: 'Lively, friendly',
  shimmer: 'Soft, nuanced',
};

/**
 * Convert text to speech, returns an MP3 Buffer
 */
export async function textToSpeech(
  text: string,
  options: {
    voice?: TTSVoice;
    speed?: number; // 0.25 ~ 4.0, default 1.0
    model?: 'tts-1' | 'tts-1-hd'; // tts-1 is faster; tts-1-hd is higher quality
  } = {},
): Promise<Buffer> {
  const { voice = 'nova', speed = 1.0, model = 'tts-1' } = options;

  // TTS has a character limit (4096 characters)
  if (text.length > 4096) {
    throw new Error('Text must not exceed 4096 characters; please segment the input');
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
 * Long-text segmented text-to-speech
 */
export async function textToSpeechLong(
  text: string,
  options: Parameters<typeof textToSpeech>[1] = {},
): Promise<Buffer> {
  const MAX_CHUNK = 4000; // Leave a small margin

  // Split on sentence boundaries to avoid cutting in the middle of a word
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

  // Generate all segments concurrently (but preserve order)
  const buffers = await Promise.all(
    chunks.map((chunk) => textToSpeech(chunk, options)),
  );

  // Merge buffers (simple concatenation of MP3 segments)
  return Buffer.concat(buffers);
}
// #endbook
