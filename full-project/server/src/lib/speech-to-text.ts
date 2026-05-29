// #book-ref ch22-speech-to-text
// ch22-multimodal/server/src/lib/speech-to-text.ts

import path from 'node:path';
import OpenAI from 'openai';
import { env } from '../env.js';

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

export interface TranscriptionResult {
  text: string;
  language?: string | undefined;
  duration?: number | undefined;
  segments?:
    | Array<{
        start: number;
        end: number;
        text: string;
      }>
    | undefined;
}

/**
 * Transcribe an audio file to text (supports mp3, mp4, wav, m4a, webm, etc.)
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  filename: string,
  options: {
    language?: string; // Specify language (e.g. 'zh' for Chinese; leave empty for auto-detection)
    prompt?: string; // Hint text to help recognize technical terms
    timestamps?: boolean; // Whether to return timestamps
  } = {},
): Promise<TranscriptionResult> {
  const { language, prompt, timestamps = false } = options;

  // Whisper determines format from filename; ensure the extension is correct
  const ext = path.extname(filename).toLowerCase();
  const supportedExts = [
    '.mp3',
    '.mp4',
    '.mpeg',
    '.mpga',
    '.m4a',
    '.wav',
    '.webm',
    '.ogg',
  ];

  if (!supportedExts.includes(ext)) {
    throw new Error(
      `Unsupported audio format: ${ext}. Supported: ${supportedExts.join(', ')}`,
    );
  }

  // Create a File object (Whisper API requires File)
  const file = new File([audioBuffer], filename, {
    type: `audio/${ext.slice(1)}`,
  });

  if (timestamps) {
    // Get detailed segment information
    const params: Record<string, unknown> = {
      file,
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['segment'],
    };
    if (language) params.language = language;
    if (prompt) params.prompt = prompt;
    const response = (await openai.audio.transcriptions.create(
      params as any,
    )) as any;

    return {
      text: response.text,
      language: response.language,
      duration: response.duration,
      segments: response.segments?.map((s: any) => ({
        start: s.start,
        end: s.end,
        text: s.text,
      })),
    };
  }

  // Text only
  const textParams: Record<string, unknown> = {
    file,
    model: 'whisper-1',
    response_format: 'text',
  };
  if (language) textParams.language = language;
  if (prompt) textParams.prompt = prompt;
  const response = await openai.audio.transcriptions.create(textParams as any);

  return { text: response as unknown as string };
}

/**
 * Streaming transcription (recognize while recording)
 * Uses chunked processing, one chunk per 30 seconds
 */
export async function* transcribeStream(
  audioChunks: AsyncIterable<Buffer>,
  options: { language?: string; prompt?: string } = {},
): AsyncGenerator<string> {
  const _CHUNK_DURATION_MS = 30_000;
  const CHUNK_SIZE = 1024 * 1024; // 1MB per chunk

  let buffer = Buffer.alloc(0);
  let chunkIndex = 0;

  for await (const chunk of audioChunks) {
    buffer = Buffer.concat([buffer, chunk]);

    // Process when chunk size is reached
    if (buffer.length >= CHUNK_SIZE) {
      const result = await transcribeAudio(
        buffer,
        `chunk-${chunkIndex}.webm`,
        options,
      );
      yield result.text;
      buffer = Buffer.alloc(0);
      chunkIndex++;
    }
  }

  // Process remaining data
  if (buffer.length > 0) {
    const result = await transcribeAudio(
      buffer,
      `chunk-${chunkIndex}.webm`,
      options,
    );
    yield result.text;
  }
}
