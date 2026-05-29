// #book ch22-speech-to-text

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
 * 音频文件转文字（支持 mp3、mp4、wav、m4a、webm 等格式）
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  filename: string,
  options: {
    language?: string; // 指定语言（如 'zh' 表示中文，留空自动检测）
    prompt?: string; // 提示词，帮助识别专业术语
    timestamps?: boolean; // 是否返回时间戳
  } = {},
): Promise<TranscriptionResult> {
  const { language, prompt, timestamps = false } = options;

  // Whisper 通过文件名判断格式，确保扩展名正确
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
      `不支持的音频格式：${ext}。支持：${supportedExts.join(', ')}`,
    );
  }

  // 创建 File 对象（Whisper API 需要 File）
  const file = new File([audioBuffer], filename, {
    type: `audio/${ext.slice(1)}`,
  });

  if (timestamps) {
    // 获取详细分段信息
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

  // 仅获取文字
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
 * 流式转录（边录音边识别）
 * 使用分块处理，每 30 秒一段
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

    // 达到块大小时处理
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

  // 处理剩余数据
  if (buffer.length > 0) {
    const result = await transcribeAudio(
      buffer,
      `chunk-${chunkIndex}.webm`,
      options,
    );
    yield result.text;
  }
}
// #endbook
